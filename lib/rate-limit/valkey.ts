import { Redis } from "ioredis";
import { errors } from "@/lib/http/errors";
import { log } from "@/lib/log";
import { BUCKET_LUA } from "./bucket-script";
import type { LimitDecision, LimitKeys, LimitScope, RateLimiter } from "./types";
import { BUDGETS } from "./weights";

export type RedisLike = {
  evalsha(sha: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  script(cmd: "LOAD", script: string): Promise<string>;
  status?: string;
};

type Opts = { budgets?: typeof BUDGETS; now?: () => number; keyPrefix?: string };

const SCOPES: readonly LimitScope[] = ["browser", "ip", "user"];
const unavailable = () =>
  errors.unavailable("limiter_unavailable", "Rate limiter is unavailable.", 5);
const isNoScript = (e: unknown) => e instanceof Error && e.message.startsWith("NOSCRIPT");

function parseReply(reply: unknown, layers: readonly LimitScope[]): LimitDecision | null {
  if (!Array.isArray(reply) || reply.length < 4 || !reply.every((n) => typeof n === "number")) {
    return null;
  }
  const [allowed, retryAfterSec, remaining, layerIndex] = reply as number[];
  return {
    allowed: allowed === 1,
    retryAfterSec: retryAfterSec ?? 0,
    remaining: remaining ?? 0,
    layer: allowed === 1 ? null : (layers[layerIndex ?? -1] ?? null),
  };
}

/** Distributed token-bucket limiter; all layers are checked and consumed atomically by one Lua script. */
export function createValkeyLimiter(client: RedisLike, opts: Opts = {}): RateLimiter {
  const budgets = opts.budgets ?? BUDGETS;
  const now = opts.now ?? Date.now;
  const prefix = opts.keyPrefix ?? "hc:rl:";
  let sha: Promise<string> | undefined;

  const run = async (numKeys: number, args: (string | number)[]): Promise<unknown> => {
    sha ??= client.script("LOAD", BUCKET_LUA);
    try {
      return await client.evalsha(await sha, numKeys, ...args);
    } catch (e) {
      if (!isNoScript(e)) throw e;
      return client.eval(BUCKET_LUA, numKeys, ...args);
    }
  };

  return {
    async consume(keys: LimitKeys, cost: number): Promise<LimitDecision> {
      const layers = SCOPES.filter((s) => keys[s] !== undefined);
      const redisKeys = layers.map((s) => `${prefix}${s}:${keys[s]}`);
      const budgetArgs = layers.flatMap((s) => [budgets[s].points, budgets[s].windowSec]);
      let decision: LimitDecision | null;
      try {
        const reply = await run(layers.length, [...redisKeys, cost, now(), ...budgetArgs]);
        decision = parseReply(reply, layers);
      } catch (err) {
        sha = undefined;
        log.error({ err }, "rate limiter backend error");
        throw unavailable();
      }
      if (!decision) throw unavailable();
      return decision;
    },
  };
}

/** ioredis client that fails fast instead of queueing commands while disconnected. */
export function createValkeyClient(url: string): RedisLike {
  const redis = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
  });
  redis.on("error", (err: Error) => log.warn({ message: err.message }, "valkey connection error"));
  return {
    evalsha: (sha, n, ...args) => redis.evalsha(sha, n, ...args),
    eval: (script, n, ...args) => redis.eval(script, n, ...args),
    script: async (cmd, script) => String(await redis.script(cmd, script)),
    get status() {
      return redis.status;
    },
  };
}
