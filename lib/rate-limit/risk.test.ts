import { describe, expect, it } from "vitest";
import {
  RISKY_OPS as RISKY_FROM_RISK,
  effectiveCost,
  riskMultiplier,
  type RiskContext,
} from "./risk";
import { RISKY_OPS } from "./weights";

const anon = (op: RiskContext["op"], browserIdAgeSec: number | null): RiskContext => ({
  browserIdAgeSec,
  authenticated: false,
  op,
});

describe("riskMultiplier", () => {
  it.each([
    ["login, no browser id, anonymous", anon("login", null), 2],
    ["login, fresh browser id (100s)", anon("login", 100), 2],
    ["login, old browser id (1000s)", anon("login", 1000), 1],
    ["read, no browser id", anon("read", null), 1],
    [
      "ask, no browser id, authenticated",
      { browserIdAgeSec: null, authenticated: true, op: "ask" as const },
      1,
    ],
  ])("%s -> %i", (_name, ctx, expected) => {
    expect(riskMultiplier(ctx)).toBe(expected);
  });

  it("never drops below 1", () => {
    for (const op of RISKY_OPS) {
      for (const age of [null, 0, 299, 300, 1e9]) {
        expect(riskMultiplier(anon(op, age))).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("effectiveCost", () => {
  it("doubles a risky anonymous cost and keeps others", () => {
    expect(effectiveCost(5, anon("login", null))).toBe(10);
    expect(effectiveCost(5, anon("read", null))).toBe(5);
  });

  it("rounds up to an integer", () => {
    expect(effectiveCost(3, anon("login", null))).toBe(6);
    expect(effectiveCost(1, anon("paste_import_per_10kb", null))).toBe(2);
  });
});

describe("RISKY_OPS", () => {
  it("is re-exported from risk.ts", () => {
    expect(RISKY_FROM_RISK).toBe(RISKY_OPS);
    expect([...RISKY_OPS]).toEqual([
      "login",
      "ask",
      "rerun",
      "paste_import_per_10kb",
      "reveal_secret",
    ]);
  });
});
