import type { LimitDecision, LimitKeys, LimitScope, RateLimiter } from "./types";
import { BUDGETS } from "./weights";

type Bucket = { tokens: number; at: number };
type Budgets = Record<LimitScope, { points: number; windowSec: number }>;

const SCOPES: readonly LimitScope[] = ["browser", "ip", "user"];
const PRUNE_THRESHOLD = 1024;

/** In-process token-bucket limiter; one bucket per `${scope}:${key}`, pruned lazily when idle. */
export function createMemoryLimiter(
  budgets: Budgets = BUDGETS,
  now: () => number = Date.now,
): RateLimiter {
  const buckets = new Map<string, Bucket>();

  const refilled = (scope: LimitScope, id: string, t: number): Bucket => {
    const { points, windowSec } = budgets[scope];
    const b = buckets.get(`${scope}:${id}`);
    if (!b) return { tokens: points, at: t };
    const tokens = Math.min(points, b.tokens + ((t - b.at) / 1000) * (points / windowSec));
    return { tokens, at: t };
  };

  const prune = (t: number) => {
    if (buckets.size < PRUNE_THRESHOLD) return;
    for (const [k, b] of buckets) {
      const { windowSec } = budgets[k.slice(0, k.indexOf(":")) as LimitScope];
      if (t - b.at > windowSec * 1000) buckets.delete(k);
    }
  };

  return {
    async consume(keys: LimitKeys, cost: number): Promise<LimitDecision> {
      const t = now();
      prune(t);
      const layers = SCOPES.flatMap((scope) => {
        const id = keys[scope];
        return id ? [{ scope, id, bucket: refilled(scope, id, t) }] : [];
      });
      const denied = layers.find((l) => l.bucket.tokens < cost);
      if (denied) {
        const rate = budgets[denied.scope].points / budgets[denied.scope].windowSec;
        return {
          allowed: false,
          retryAfterSec: Math.ceil((cost - denied.bucket.tokens) / rate),
          remaining: Math.floor(denied.bucket.tokens),
          layer: denied.scope,
        };
      }
      for (const l of layers) {
        buckets.set(`${l.scope}:${l.id}`, { tokens: l.bucket.tokens - cost, at: t });
      }
      const remaining = Math.min(...layers.map((l) => Math.floor(l.bucket.tokens - cost)));
      return { allowed: true, retryAfterSec: 0, remaining, layer: null };
    },
  };
}
