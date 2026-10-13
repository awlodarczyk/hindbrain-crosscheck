import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/client";
import { hashPasswordSync } from "@/lib/auth/password";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { resetEnvForTests } from "@/lib/env";
import { BUDGETS } from "@/lib/rate-limit/weights";
import { createMemoryLimiter } from "@/lib/rate-limit/memory";
import { createUser } from "@/lib/repos/users";
import { authSessions } from "@/lib/db/schema-auth";
import { SESSION_TTL_MS } from "@/lib/auth/session";
import { LoginBody } from "@/lib/auth/login-body";

// Exception to "process.env only via lib/env.ts": the env singleton is parsed from process.env on first access.
const ORIGINAL = { ...process.env };
const PASSWORD = "correct-horse-battery";
let db: Db;
let login: typeof import("@/app/api/auth/login/route");
let logout: typeof import("@/app/api/auth/logout/route");
let me: typeof import("@/app/api/auth/me/route");

function useMode(mode: "hosted" | "local") {
  process.env.APP_MODE = mode;
  process.env.APP_URL = "http://localhost:4173";
  process.env.VALKEY_URL = "memory://local";
  process.env.TRUST_PROXY = "1";
  process.env.ADMIN_EMAIL = "admin@example.test";
  process.env.ADMIN_PASSWORD = PASSWORD;
  resetEnvForTests();
}

beforeAll(async () => {
  useMode("hosted");
  login = await import("@/app/api/auth/login/route");
  logout = await import("@/app/api/auth/logout/route");
  me = await import("@/app/api/auth/me/route");
});
afterAll(() => {
  process.env = { ...ORIGINAL };
  resetEnvForTests();
});
beforeEach(() => {
  useMode("hosted");
  db = createTestDb();
  createUser(db, { email: "admin@example.test", passwordHash: hashPasswordSync(PASSWORD) });
  setDepsForTests({ db, limiter: createMemoryLimiter() });
});
afterEach(() => resetDepsForTests());

const post = (url: string, body?: unknown, cookie?: string) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const signIn = (password = PASSWORD, email = "admin@example.test") =>
  login.POST(post("/api/auth/login", { email, password }));
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

describe("auth routes", () => {
  it("rejects a wrong password and an unknown email identically", async () => {
    const wrong = await signIn("wrong-password-1");
    const unknown = await signIn(PASSWORD, "nobody@example.test");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const a = await wrong.json();
    const b = await unknown.json();
    expect(a.error).toEqual({
      code: "invalid_credentials",
      message: "Email or password is incorrect.",
    });
    expect(b).toEqual(a);
  });

  it("signs in with an HttpOnly Lax cookie", async () => {
    const res = await signIn();
    expect(res.status).toBe(200);
    expect((await res.json()).data.email).toBe("admin@example.test");
    const header = res.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/^hc_session=[\w-]{40,};/);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).not.toContain("Secure");
  });

  it("me requires the cookie", async () => {
    const cookie = cookieOf(await signIn());
    const withCookie = await me.GET(
      new Request("http://localhost/api/auth/me", { headers: { cookie } }),
    );
    expect(withCookie.status).toBe(200);
    expect((await withCookie.json()).data).toMatchObject({
      email: "admin@example.test",
      mode: "hosted",
    });
    expect((await me.GET(new Request("http://localhost/api/auth/me"))).status).toBe(401);
  });

  it("accepts a short password in the body and answers 401 generically", async () => {
    expect(LoginBody.safeParse({ email: "a@b.co", password: "short" }).success).toBe(true);
    expect((await signIn("short")).status).toBe(401);
  });

  it("re-issues the cookie when the session is near expiry", async () => {
    const cookie = cookieOf(await signIn());
    const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    db.update(authSessions).set({ expiresAt: soon }).run();
    const res = await me.GET(new Request("http://localhost/api/auth/me", { headers: { cookie } }));
    expect(res.status).toBe(200);
    const header = res.headers.get("set-cookie") ?? "";
    expect(header).toContain(`${cookie};`);
    expect(header).toContain(`Max-Age=${SESSION_TTL_MS / 1000}`);
    const row = db.select().from(authSessions).get();
    expect(new Date(row?.expiresAt ?? 0).getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 3600 * 1000,
    );
  });

  it("does not re-issue the cookie for a fresh session", async () => {
    const cookie = cookieOf(await signIn());
    const res = await me.GET(new Request("http://localhost/api/auth/me", { headers: { cookie } }));
    expect(res.headers.get("set-cookie") ?? "").not.toContain("hc_session=");
  });

  it("logout clears the cookie and revokes the session", async () => {
    const cookie = cookieOf(await signIn());
    const res = await logout.POST(post("/api/auth/logout", undefined, cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    const after = await me.GET(
      new Request("http://localhost/api/auth/me", { headers: { cookie } }),
    );
    expect(after.status).toBe(401);
  });

  it("rate limits repeated logins per ip", async () => {
    setDepsForTests({
      limiter: createMemoryLimiter({ ...BUDGETS, ip: { points: 50, windowSec: 600 } }),
    });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await signIn("wrong-password-1")).status);
    const firstBlocked = statuses.indexOf(429);
    expect(firstBlocked).toBeGreaterThan(0);
    expect(statuses.slice(0, firstBlocked).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(firstBlocked).every((s) => s === 429)).toBe(true);
  });

  it("login does not exist in local mode", async () => {
    useMode("local");
    expect((await signIn()).status).toBe(404);
  });
});
