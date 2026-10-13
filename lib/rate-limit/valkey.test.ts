import { describe, expect, it } from "vitest";
import { BUCKET_LUA } from "./bucket-script";
import { createValkeyLimiter, type RedisLike } from "./valkey";

const budgets = {
  browser: { points: 30, windowSec: 600 },
  ip: { points: 300, windowSec: 600 },
  user: { points: 60, windowSec: 600 },
};

function fakeClient(reply: unknown | (() => unknown), failEvalsha?: Error) {
  const calls: { fn: string; args: unknown[] }[] = [];
  const next = () => (typeof reply === "function" ? (reply as () => unknown)() : reply);
  const client: RedisLike = {
    script: async (...args) => (calls.push({ fn: "script", args }), "sha1"),
    evalsha: async (...args) => {
      calls.push({ fn: "evalsha", args });
      if (failEvalsha) throw failEvalsha;
      return next();
    },
    eval: async (...args) => (calls.push({ fn: "eval", args }), next()),
  };
  return { client, calls };
}

const keys = { browser: "b1", ip: "1.2.3.4", user: "u1" };

describe("createValkeyLimiter", () => {
  it("builds keys and args for present layers and maps an allow", async () => {
    const { client, calls } = fakeClient([1, 0, 17, -1]);
    const limiter = createValkeyLimiter(client, { budgets, now: () => 1000 });
    const d = await limiter.consume(keys, 10);
    expect(d).toEqual({ allowed: true, retryAfterSec: 0, remaining: 17, layer: null });
    expect(calls[0]).toEqual({ fn: "script", args: ["LOAD", BUCKET_LUA] });
    expect(calls[1]?.args).toEqual([
      "sha1",
      3,
      "hc:rl:browser:b1",
      "hc:rl:ip:1.2.3.4",
      "hc:rl:user:u1",
      10,
      1000,
      30,
      600,
      300,
      600,
      60,
      600,
    ]);
  });
  it("omits absent layers and maps a deny to its layer name", async () => {
    const { client, calls } = fakeClient([0, 4, 2, 1]);
    const d = await createValkeyLimiter(client, { budgets, now: () => 5 }).consume(
      { ip: "9.9.9.9", user: "u" },
      10,
    );
    expect(calls[1]?.args.slice(1, 4)).toEqual([2, "hc:rl:ip:9.9.9.9", "hc:rl:user:u"]);
    expect(d).toEqual({ allowed: false, retryAfterSec: 4, remaining: 2, layer: "user" });
  });
  it("loads the script once and falls back to EVAL on NOSCRIPT", async () => {
    const { client, calls } = fakeClient([1, 0, 1, -1], new Error("NOSCRIPT No matching script"));
    const limiter = createValkeyLimiter(client, { budgets });
    await limiter.consume(keys, 1);
    await limiter.consume(keys, 1);
    expect(calls.filter((c) => c.fn === "script")).toHaveLength(1);
    expect(calls.filter((c) => c.fn === "eval")).toHaveLength(2);
  });
  it("fails closed with limiter_unavailable on connection errors and bad replies", async () => {
    const down = fakeClient(1, new Error("connect ECONNREFUSED"));
    await expect(createValkeyLimiter(down.client).consume(keys, 1)).rejects.toMatchObject({
      status: 503,
      code: "limiter_unavailable",
    });
    const bad = fakeClient("nope");
    await expect(createValkeyLimiter(bad.client).consume(keys, 1)).rejects.toMatchObject({
      status: 503,
    });
  });
});
