import type { LimitScope } from "./types";

export const OPERATION_COST = {
  read: 1,
  login: 5,
  ask: 10,
  rerun: 10,
  retry: 5,
  paste_import_per_10kb: 1,
  paste_import_min: 5,
  reveal_secret: 10,
  settings_write: 3,
  provider_test: 5,
  logout: 1,
} as const;

export type OperationName = keyof typeof OPERATION_COST;

/** Operations that get the anonymous risk multiplier (see `risk.ts`). */
export const RISKY_OPS: readonly OperationName[] = [
  "login",
  "ask",
  "rerun",
  "paste_import_per_10kb",
  "reveal_secret",
];

export const BUDGETS: Record<LimitScope, { points: number; windowSec: number }> = {
  browser: { points: 300, windowSec: 600 },
  ip: { points: 3000, windowSec: 600 },
  user: { points: 600, windowSec: 600 },
};

const TEN_KB = 10_240;

/** Points an operation costs; paste imports scale with body size (minimum `paste_import_min`). */
export function costForBody(op: OperationName, bodyBytes = 0): number {
  return op === "paste_import_per_10kb"
    ? Math.max(OPERATION_COST.paste_import_min, Math.ceil(bodyBytes / TEN_KB))
    : OPERATION_COST[op];
}
