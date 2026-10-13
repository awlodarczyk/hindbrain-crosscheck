import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { createMemoryLimiter } from "@/lib/rate-limit/memory";
import { ctx } from "../helpers/route-ctx";

let sessions: typeof import("@/app/api/sessions/route");

beforeEach(async () => {
  sessions = await import("@/app/api/sessions/route");
  setDepsForTests({ db: createTestDb(), limiter: createMemoryLimiter() });
});
afterEach(() => resetDepsForTests());

const post = (headers: Record<string, string>) =>
  new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ question: "hello?" }),
  });

describe("csrf on mutations", () => {
  it("blocks a cross-origin POST before parsing the body", async () => {
    const res = await sessions.POST(post({ origin: "https://evil.example" }), ctx());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: "csrf", details: { reason: "origin_mismatch" } });
  });

  it("blocks a POST with no origin signals", async () => {
    const res = await sessions.POST(post({}), ctx());
    expect((await res.json()).error.details.reason).toBe("missing_origin");
  });

  it("passes a same-origin POST through to the normal flow", async () => {
    const res = await sessions.POST(post({ "sec-fetch-site": "same-origin" }), ctx());
    expect(res.status).not.toBe(403);
  });

  it("does not affect GET", async () => {
    const res = await sessions.GET(new Request("http://localhost/api/sessions"), ctx());
    expect(res.status).toBe(200);
  });
});
