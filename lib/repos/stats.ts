import type { SessionStatus } from "@/lib/db/enums";
import type { Call, Claim, SessionStats } from "./types";

/** Aggregates stats for the given calls and the claims that belong to them. */
export function computeStats(calls: readonly Call[], claims: readonly Claim[]): SessionStats {
  const ids = new Set(calls.map((c) => c.id));
  const own = claims.filter((c) => ids.has(c.callId));
  const count = (v: Claim["verdict"]) => own.filter((c) => c.verdict === v).length;
  const costs = calls.flatMap((c) => (c.costUsd === null ? [] : [c.costUsd]));
  return Object.freeze({
    claims: own.length,
    supported: count("supported"),
    disputed: count("disputed"),
    partial: count("partial"),
    unverifiable: count("unverifiable"),
    calls: calls.length,
    callsDone: calls.filter((c) => c.status === "done").length,
    searches: calls.reduce((a, c) => a + c.searches, 0),
    durationMs: calls.reduce((a, c) => a + (c.durationMs ?? 0), 0),
    costUsd: costs.length ? costs.reduce((a, b) => a + b, 0) : null,
  });
}

/** Derives the session status from its latest run's calls; skipped calls are ignored. */
export function deriveSessionStatus(calls: readonly Call[]): SessionStatus {
  const live = calls.filter((c) => c.status !== "skipped");
  const has = (s: Call["status"]) => live.some((c) => c.status === s);
  if (live.length === 0) return "queued";
  if (has("running")) return "running";
  if (has("queued")) return has("done") || has("failed") ? "running" : "queued";
  if (!has("failed")) return "done";
  return has("done") ? "partial" : "failed";
}
