import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createValkeyClient, createValkeyLimiter } from "@/lib/rate-limit/valkey";
import type { RateLimiter } from "@/lib/rate-limit/types";

// Exception to the "env only via lib/env.ts" rule: this test-only switch is not application config.
const url = process.env.VALKEY_TEST_URL;
const budgets = {
  browser: { points: 30, windowSec: 600 },
  ip: { points: 100, windowSec: 600 },
  user: { points: 60, windowSec: 600 },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!url)("valkey limiter (real server)", () => {
  let admin: Redis;
  let limiter: RateLimiter;
  const prefix = `hc:test:${Date.now()}:`;

  beforeAll(async () => {
    admin = new Redis(url as string);
    limiter = createValkeyLimiter(createValkeyClient(url as string), {
      budgets,
      keyPrefix: prefix,
    });
  });
  afterAll(async () => {
    const keys = await admin.keys(`${prefix}*`);
    if (keys.length) await admin.del(...keys);
    admin.disconnect();
  });

  it("denies the 31st point on one browser with layer browser", async () => {
    const keys = { browser: "b-deny", ip: "10.0.0.1" };
    for (let i = 0; i < 30; i++) expect((await limiter.consume(keys, 1)).allowed).toBe(true);
    const d = await limiter.consume(keys, 1);
    expect(d).toMatchObject({ allowed: false, layer: "browser" });
    expect(d.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("does not partially consume when a layer denies", async () => {
    const keys = { browser: "b-atomic", ip: "10.0.0.2" };
    await limiter.consume(keys, 30);
    const before = await admin.hget(`${prefix}ip:10.0.0.2`, "tokens");
    expect((await limiter.consume(keys, 1)).allowed).toBe(false);
    expect(await admin.hget(`${prefix}ip:10.0.0.2`, "tokens")).toBe(before);
  });

  it("refills over time", async () => {
    const fast = createValkeyLimiter(createValkeyClient(url as string), {
      budgets: { ...budgets, ip: { points: 3, windowSec: 3 } },
      keyPrefix: prefix,
    });
    const keys = { ip: "10.0.0.3" };
    await fast.consume(keys, 3);
    expect((await fast.consume(keys, 1)).allowed).toBe(false);
    await sleep(1100);
    expect((await fast.consume(keys, 1)).allowed).toBe(true);
  });

  it("recovers from a flushed script cache", async () => {
    await admin.script("FLUSH");
    expect((await limiter.consume({ ip: "10.0.0.4" }, 1)).allowed).toBe(true);
  });

  it("sets a TTL on the keys", async () => {
    await limiter.consume({ ip: "10.0.0.5" }, 1);
    const ttl = await admin.pttl(`${prefix}ip:10.0.0.5`);
    expect(ttl).toBeGreaterThan(0);
  });
});
