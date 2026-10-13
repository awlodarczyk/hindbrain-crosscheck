import { describe, expect, it } from "vitest";
import { computeStats, deriveSessionStatus } from "./stats";
import type { Call, Claim } from "./types";

const mkCall = (p: Partial<Call> = {}): Call => ({
  id: "c",
  runId: "r",
  kind: "answer",
  provider: "claude",
  transport: "mock",
  model: "m",
  status: "done",
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  searches: 0,
  inputTokens: null,
  outputTokens: null,
  costUsd: null,
  text: null,
  html: null,
  citations: [],
  errorCode: null,
  errorMessage: null,
  pasted: false,
  ...p,
});

const mkClaim = (callId: string, verdict: Claim["verdict"], idx = 0): Claim => ({
  id: `${callId}-${idx}`,
  callId,
  idx,
  claim: "x",
  verdict,
  note: null,
  sourceUrl: null,
  sourceTitle: null,
});

describe("computeStats", () => {
  it("sums claims and call metrics", () => {
    const calls = [1, 2, 3, 4].map((n) =>
      mkCall({ id: `c${n}`, searches: n, durationMs: n * 10, costUsd: n / 10 }),
    );
    const claims = [
      ...Array.from({ length: 8 }, (_, i) => mkClaim(`c${(i % 4) + 1}`, "supported", i)),
      ...Array.from({ length: 3 }, (_, i) => mkClaim("c1", "disputed", 10 + i)),
      mkClaim("other", "partial"),
    ];
    const s = computeStats(calls, claims);
    expect(s).toMatchObject({
      claims: 11,
      supported: 8,
      disputed: 3,
      partial: 0,
      unverifiable: 0,
      calls: 4,
      callsDone: 4,
      searches: 10,
      durationMs: 100,
    });
    expect(s.costUsd).toBeCloseTo(1);
  });

  it("costUsd is null when every cost is null; nulls count as 0 duration", () => {
    const s = computeStats([mkCall(), mkCall({ status: "failed" })], [mkClaim("c", "partial")]);
    expect(s.costUsd).toBeNull();
    expect(s.durationMs).toBe(0);
    expect(s.callsDone).toBe(1);
    expect(s.partial).toBe(1);
  });
});

describe("deriveSessionStatus", () => {
  const st = (...s: Call["status"][]) => deriveSessionStatus(s.map((status) => mkCall({ status })));
  it("covers each rule", () => {
    expect(st()).toBe("queued");
    expect(st("done", "done")).toBe("done");
    expect(st("failed", "done", "done", "done")).toBe("partial");
    expect(st("failed", "failed")).toBe("failed");
    expect(st("running", "done")).toBe("running");
    expect(st("queued", "done")).toBe("running");
    expect(st("queued", "failed")).toBe("running");
    expect(st("queued", "queued")).toBe("queued");
    expect(st("done", "skipped")).toBe("done");
    expect(st("skipped")).toBe("queued");
  });
});
