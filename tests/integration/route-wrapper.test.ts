import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineRoute } from "@/lib/http/route";
import { errors } from "@/lib/http/errors";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { createMemoryLimiter } from "@/lib/rate-limit/memory";
import type { RateLimiter } from "@/lib/rate-limit/types";
import { log } from "@/lib/log";

const allowAll: RateLimiter = {
  consume: async () => ({ allowed: true, retryAfterSec: 0, remaining: 42, layer: null }),
};

beforeEach(() => {
  setDepsForTests({ limiter: allowAll, auth: async () => ({ userId: "u1" }) });
});
afterEach(() => {
  resetDepsForTests();
  vi.restoreAllMocks();
});

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });

const echo = defineRoute(
  { op: "ask", body: z.object({ n: z.number() }), maxBodyBytes: 64 },
  ({ body, ctx }) => ({ n: body.n, userId: ctx.userId }),
);

describe("defineRoute", () => {
  it("wraps results in the envelope with standard headers", async () => {
    const res = await echo(post('{"n":1}', { "x-request-id": "abcdef123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { n: 1, userId: "u1" } });
    expect(res.headers.get("x-request-id")).toBe("abcdef123456");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("42");
  });

  it("generates a request id when absent or invalid", async () => {
    const res = await echo(post('{"n":1}', { "x-request-id": "bad id!" }));
    expect(res.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9_-]{8,}$/);
  });

  it("400 with issues on invalid body", async () => {
    const res = await echo(post('{"n":"x"}'));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe("validation_failed");
    expect(json.error.details.issues[0]).toMatchObject({ path: "n" });
  });

  it("400 invalid_json", async () => {
    const res = await echo(post("{nope"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_json");
  });

  it("413 by content-length and by actual size", async () => {
    const big = JSON.stringify({ n: 1, pad: "x".repeat(100) });
    expect((await echo(post(big))).status).toBe(413);
    const lying = await echo(post(big, { "content-length": "5" }));
    expect(lying.status).toBe(413);
  });

  it("415 on wrong content-type", async () => {
    const res = await echo(post('{"n":1}', { "content-type": "text/plain" }));
    expect(res.status).toBe(415);
  });

  it("401 when the guard returns null", async () => {
    setDepsForTests({ auth: async () => null });
    expect((await echo(post('{"n":1}'))).status).toBe(401);
  });

  it("auth none skips the guard", async () => {
    setDepsForTests({ auth: async () => null });
    const r = defineRoute({ auth: "none", op: "read" }, ({ ctx }) => ctx.userId);
    expect((await r(new Request("http://localhost/"))).status).toBe(200);
  });

  it("429 with Retry-After when the limiter denies", async () => {
    setDepsForTests({
      limiter: {
        consume: async () => ({ allowed: false, retryAfterSec: 12, remaining: 0, layer: "ip" }),
      },
    });
    const res = await echo(post('{"n":1}'));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
    expect((await res.json()).error.details).toEqual({ retryAfterSec: 12, layer: "ip", cost: 10 });
  });

  it("anonymous ask without a browser cookie is charged double and reports the cost", async () => {
    const consume = vi.fn(allowAll.consume);
    setDepsForTests({ limiter: { consume } });
    const anonAsk = defineRoute({ auth: "none", op: "ask" }, () => 1);
    const res = await anonAsk(new Request("http://localhost/"));
    expect(consume).toHaveBeenCalledWith(expect.anything(), 20);
    expect(res.headers.get("x-ratelimit-cost")).toBe("20");
  });

  it("the same anonymous ask with a browser cookie costs the base amount", async () => {
    const consume = vi.fn(allowAll.consume);
    setDepsForTests({ limiter: { consume } });
    const anonAsk = defineRoute({ auth: "none", op: "ask" }, () => 1);
    const res = await anonAsk(
      new Request("http://localhost/", { headers: { cookie: "hc_bid=abcdefghijklmnop" } }),
    );
    expect(consume).toHaveBeenCalledWith(expect.anything(), 10);
    expect(res.headers.get("x-ratelimit-cost")).toBe("10");
  });

  it("429 carries layer, retry-after and the effective cost", async () => {
    setDepsForTests({
      limiter: {
        consume: async () => ({ allowed: false, retryAfterSec: 7, remaining: 0, layer: "browser" }),
      },
    });
    const anonAsk = defineRoute({ auth: "none", op: "ask" }, () => 1);
    const res = await anonAsk(new Request("http://localhost/"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    const details = (await res.json()).error.details;
    expect(details).toEqual({ retryAfterSec: 7, layer: "browser", cost: 20 });
  });

  it("does not charge the limiter for invalid requests", async () => {
    const consume = vi.fn(allowAll.consume);
    setDepsForTests({ limiter: { consume } });
    await echo(post('{"n":"x"}'));
    expect(consume).not.toHaveBeenCalled();
  });

  it("charges with the user key and op cost", async () => {
    const consume = vi.fn(allowAll.consume);
    setDepsForTests({ limiter: { consume } });
    await echo(post('{"n":1}'));
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ user: "u1" }), 10);
  });

  it("supports function ops using body bytes", async () => {
    const consume = vi.fn(allowAll.consume);
    setDepsForTests({ limiter: { consume } });
    const r = defineRoute({ op: ({ bodyBytes }) => bodyBytes, body: z.object({}) }, () => null);
    await r(post("{}"));
    expect(consume).toHaveBeenCalledWith(expect.anything(), 2);
  });

  it("masks unknown errors and logs them", async () => {
    const spy = vi.spyOn(log, "error");
    const r = defineRoute({ op: "read" }, () => {
      throw new Error("secret detail");
    });
    const res = await r(new Request("http://localhost/"));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toContain("secret detail");
    expect(JSON.parse(text).error.code).toBe("internal");
    expect(spy).toHaveBeenCalled();
  });

  it("maps thrown HttpError to the envelope", async () => {
    const r = defineRoute({ op: "read" }, () => {
      throw errors.notFound();
    });
    const res = await r(new Request("http://localhost/"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  it("passes Response through and merges headers", async () => {
    const r = defineRoute(
      { op: "read" },
      () =>
        new Response("data: hi\n\n", {
          status: 201,
          headers: { "content-type": "text/event-stream" },
        }),
    );
    const res = await r(new Request("http://localhost/"));
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("data: hi\n\n");
  });

  it("parses and validates query, last repeated key wins", async () => {
    const r = defineRoute({ op: "read", query: z.object({ q: z.string() }) }, ({ query }) => query);
    const ok = await r(new Request("http://localhost/?q=a&q=b"));
    expect((await ok.json()).data).toEqual({ q: "b" });
    const bad = await r(new Request("http://localhost/"));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.details.issues).toBeInstanceOf(Array);
  });

  it("resolves params promises and plain objects", async () => {
    const r = defineRoute({ op: "read" }, ({ params }) => params);
    const a = await r(new Request("http://localhost/"), { params: Promise.resolve({ id: "1" }) });
    expect((await a.json()).data).toEqual({ id: "1" });
    const b = await r(new Request("http://localhost/"), { params: { id: "2" } });
    expect((await b.json()).data).toEqual({ id: "2" });
  });

  it("ignores the body of routes without a body spec", async () => {
    const r = defineRoute({ op: "read" }, ({ body }) => body ?? "none");
    const res = await r(post("garbage", { "content-type": "text/plain" }));
    expect((await res.json()).data).toBe("none");
  });

  it("works with the real memory limiter", async () => {
    resetDepsForTests();
    setDepsForTests({ limiter: createMemoryLimiter(), auth: async () => ({ userId: "u1" }) });
    const r = defineRoute({ op: "read" }, () => 1);
    const res = await r(new Request("http://localhost/"));
    expect(res.headers.get("x-ratelimit-remaining")).toBe("599");
  });
});
