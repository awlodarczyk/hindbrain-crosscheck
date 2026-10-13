import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/client";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { createMemoryLimiter } from "@/lib/rate-limit/memory";
import { listUserEvents } from "@/lib/repos/events";
import { providerSecrets } from "@/lib/db/schema-auth";
import * as registry from "@/lib/providers/registry";
import { resetEnvForTests } from "@/lib/env";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";

// Exception to "process.env only via lib/env.ts": the env singleton is parsed from process.env on first access.
const ORIGINAL = { ...process.env };
let db: Db;
let settingsRoute: typeof import("@/app/api/settings/route");
let secretsRoute: typeof import("@/app/api/settings/keys/route");
let revealRoute: typeof import("@/app/api/settings/keys/reveal/route");
let testRoute: typeof import("@/app/api/providers/[id]/test/route");

beforeAll(async () => {
  process.env.PROVIDER_TRANSPORT = "mock";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  resetEnvForTests();
  settingsRoute = await import("@/app/api/settings/route");
  secretsRoute = await import("@/app/api/settings/keys/route");
  revealRoute = await import("@/app/api/settings/keys/reveal/route");
  testRoute = await import("@/app/api/providers/[id]/test/route");
});
afterAll(() => {
  process.env = { ...ORIGINAL };
  resetEnvForTests();
});
beforeEach(() => {
  db = createTestDb();
  ensureLocalUser(db);
  setDepsForTests({
    db,
    limiter: createMemoryLimiter(),
    auth: async () => ({ userId: LOCAL_USER_ID }),
  });
});
afterEach(() => resetDepsForTests());

const KEY = "sk-ant-abcdefghijklmnopqrstuvwxyz1234";
const json = (method: string, body?: unknown) =>
  new Request("http://localhost/api/x", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const get = async () => (await settingsRoute.GET(json("GET"))).json();

describe("settings api", () => {
  it("GET returns defaults with no secrets", async () => {
    const body = await get();
    expect(body.ok).toBe(true);
    expect(body.data.secrets.claude.source).toBe("none");
    expect(body.data.savedAt).toBeNull();
    expect(body.data.mode).toBe("local");
    expect(typeof body.data.cliAllowed).toBe("boolean");
  });

  it("PUT rejects invalid settings", async () => {
    const current = (await get()).data.settings;
    const bad = { ...current, tuning: { ...current.tuning, temperature: 2 } };
    expect((await settingsRoute.PUT(json("PUT", bad))).status).toBe(400);
  });

  it("PUT saves and GET reflects", async () => {
    const current = (await get()).data.settings;
    const next = { ...current, tuning: { ...current.tuning, temperature: 0.5 } };
    const res = await settingsRoute.PUT(json("PUT", next));
    const saved = await res.json();
    expect(res.status).toBe(200);
    expect(saved.data.savedAt).toBeTruthy();
    const after = await get();
    expect(after.data.settings.tuning.temperature).toBe(0.5);
    expect(after.data.savedAt).toBe(saved.data.savedAt);
  });

  it("secret lifecycle: put, view, reveal, delete", async () => {
    const put = await secretsRoute.PUT(json("PUT", { provider: "claude", apiKey: KEY }));
    const putBody = await put.json();
    expect(putBody.data.masked.endsWith("1234")).toBe(true);
    expect(JSON.stringify(putBody)).not.toContain(KEY);

    const view = (await get()).data.secrets.claude;
    expect(view).toMatchObject({ source: "db", valid: null });
    expect(view.masked.endsWith("1234")).toBe(true);
    expect(JSON.stringify(await get())).not.toContain(KEY);

    const reveal = await revealRoute.POST(json("POST", { provider: "claude" }));
    expect((await reveal.json()).data).toEqual({ provider: "claude", apiKey: KEY });
    expect(listUserEvents(db, LOCAL_USER_ID, "reveal_secret").length).toBe(1);

    const del = await secretsRoute.DELETE(json("DELETE", { provider: "claude" }));
    expect(del.status).toBe(200);
    expect((await get()).data.secrets.claude.source).toBe("none");
    expect((await revealRoute.POST(json("POST", { provider: "claude" }))).status).toBe(404);
  });

  it("rejects malformed keys", async () => {
    const res = await secretsRoute.PUT(json("PUT", { provider: "claude", apiKey: "short" }));
    expect(res.status).toBe(400);
  });

  it("provider test returns ok with the mock transport", async () => {
    const res = await testRoute.POST(json("POST"), { params: Promise.resolve({ id: "claude" }) });
    const body = await res.json();
    expect(body.data).toMatchObject({ ok: true, transport: "mock" });
  });

  it("provider test 404s for unknown ids", async () => {
    const res = await testRoute.POST(json("POST"), { params: Promise.resolve({ id: "gemini" }) });
    expect(res.status).toBe(404);
  });
});

describe("undecryptable stored key", () => {
  const corrupt = () => {
    db.update(providerSecrets)
      .set({ ciphertext: "AAAA", iv: "AAAA", tag: "AAAA" })
      .where(eq(providerSecrets.provider, "claude"))
      .run();
  };
  beforeEach(async () => {
    await secretsRoute.PUT(json("PUT", { provider: "claude", apiKey: KEY }));
    corrupt();
  });

  it("GET flags the secret as broken", async () => {
    const body = await get();
    expect(body.ok).toBe(true);
    expect(body.data.secrets.claude).toMatchObject({
      source: "db",
      masked: null,
      valid: false,
      broken: true,
    });
  });

  it("reveal answers 409 secret_unreadable", async () => {
    const res = await revealRoute.POST(json("POST", { provider: "claude" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("secret_unreadable");
  });

  it("provider test reports a failed status", async () => {
    const res = await testRoute.POST(json("POST"), { params: Promise.resolve({ id: "claude" }) });
    expect((await res.json()).data).toEqual({
      ok: false,
      transport: "mock",
      detail: "Stored key cannot be decrypted. Replace it.",
    });
  });
});

describe("provider test failure", () => {
  it("reports 'Test failed.' when the provider cannot be created", async () => {
    vi.spyOn(registry, "createProvider").mockImplementation(() => {
      throw new Error("boom");
    });
    try {
      const res = await testRoute.POST(json("POST"), { params: Promise.resolve({ id: "claude" }) });
      expect((await res.json()).data).toMatchObject({ ok: false, detail: "Test failed." });
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("hosted mode reveal", () => {
  const keys = [
    "APP_MODE",
    "APP_URL",
    "TRUST_PROXY",
    "VALKEY_URL",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
  ] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  beforeEach(() => {
    process.env.APP_MODE = "hosted";
    process.env.APP_URL = "https://app.example.com";
    process.env.VALKEY_URL = "memory://local";
    process.env.TRUST_PROXY = "1";
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    resetEnvForTests();
  });
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetEnvForTests();
  });

  it("rejects a reveal without a password with 400", async () => {
    await secretsRoute.PUT(json("PUT", { provider: "claude", apiKey: KEY }));
    const res = await revealRoute.POST(json("POST", { provider: "claude" }));
    expect(res.status).toBe(400);
  });
});
