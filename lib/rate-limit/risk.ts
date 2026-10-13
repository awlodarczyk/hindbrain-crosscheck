import { RISKY_OPS, type OperationName } from "./weights";

export { RISKY_OPS };

export type RiskContext = {
  /** Age of the browser id in seconds; `null` when the caller has no browser id. */
  browserIdAgeSec: number | null;
  authenticated: boolean;
  op: OperationName;
};

const FRESH_BROWSER_SEC = 300;
const RISK_MULTIPLIER = 2;
const RISKY_SET: ReadonlySet<OperationName> = new Set(RISKY_OPS);

/** Anonymous risky operations from a fresh or absent browser id cost double; never below 1. */
export function riskMultiplier(ctx: RiskContext): number {
  if (ctx.authenticated) return 1;
  const risky = RISKY_SET.has(ctx.op);
  const fresh = ctx.browserIdAgeSec === null || ctx.browserIdAgeSec < FRESH_BROWSER_SEC;
  return risky && fresh ? RISK_MULTIPLIER : 1;
}

/** Base cost scaled by the risk multiplier, rounded up to whole points. */
export function effectiveCost(baseCost: number, ctx: RiskContext): number {
  return Math.ceil(baseCost * riskMultiplier(ctx));
}
