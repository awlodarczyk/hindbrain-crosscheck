export type LimitScope = "browser" | "ip" | "user";
export type LimitKeys = { browser?: string; ip: string; user?: string };
export type LimitDecision = {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
  layer: LimitScope | null;
};

export interface RateLimiter {
  /** Checks every layer first and consumes only when all allow; reports the first exhausted layer. */
  consume(keys: LimitKeys, cost: number): Promise<LimitDecision>;
}
