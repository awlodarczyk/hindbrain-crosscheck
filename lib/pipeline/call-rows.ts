import type { CallKind, ProviderId } from "@/lib/db/enums";
import { createCall, listCalls, updateCall } from "@/lib/repos/calls";
import { replaceClaims } from "@/lib/repos/claims";
import { recomputeStats } from "@/lib/repos/sessions";
import { deriveSessionStatus } from "@/lib/repos/stats";
import type { Call } from "@/lib/repos/types";
import { isProviderError } from "@/lib/providers/errors";
import type { ColumnDeps } from "./column";

/** The subset of column deps needed to write call rows and publish stats. */
export type RowDeps = Pick<ColumnDeps, "db" | "providers" | "emit" | "now" | "sessionId" | "runId">;
export type CallPatch = Partial<Omit<Call, "id" | "runId">>;

const MAX_ERROR_CHARS = 500;

export const clock = (d: Pick<ColumnDeps, "now">): Date => (d.now ?? (() => new Date()))();

const blank = (deps: RowDeps, provider: ProviderId, model: string): CallPatch => ({
  transport: deps.providers[provider].transport,
  model,
  ...{ startedAt: null, finishedAt: null, durationMs: null, searches: 0, pasted: false },
  ...{ inputTokens: null, outputTokens: null, costUsd: null, text: null, html: null },
  ...{ citations: [], errorCode: null, errorMessage: null },
});

/** Creates a call row, or resets an existing one (dropping its claims) before applying `patch`. */
export function upsertCall(
  deps: RowDeps,
  kind: CallKind,
  provider: ProviderId,
  existingId: string | undefined,
  patch: CallPatch & { model: string },
): Call {
  const fields = { ...blank(deps, provider, patch.model), ...patch };
  if (!existingId)
    return createCall(deps.db, {
      ...fields,
      runId: deps.runId,
      kind,
      provider,
      transport: deps.providers[provider].transport,
    });
  replaceClaims(deps.db, existingId, []);
  return updateCall(deps.db, existingId, fields);
}

/** Applies `patch`, recomputes the session stats and emits `session.stats`. */
export function settle(deps: RowDeps, id: string, patch: CallPatch): Call {
  const call = updateCall(deps.db, id, patch);
  const stats = recomputeStats(deps.db, deps.sessionId, deps.now);
  const status = deriveSessionStatus(listCalls(deps.db, deps.runId));
  deps.emit({ type: "session.stats", sessionId: deps.sessionId, stats, status });
  return call;
}

/** Marks the call failed with the error's code (`internal` for non-provider errors). */
export function fail(deps: RowDeps, id: string, e: unknown): void {
  const code = isProviderError(e) ? e.code : "internal";
  const raw = e instanceof Error ? e.message : "Unexpected error.";
  const message = raw.slice(0, MAX_ERROR_CHARS);
  settle(deps, id, {
    status: "failed",
    finishedAt: clock(deps).toISOString(),
    errorCode: code,
    errorMessage: message,
  });
  deps.emit({ type: "call.failed", sessionId: deps.sessionId, callId: id, code, message });
}

/** Emits `call.done` for a finished call; `claims` is set for reviews. */
export function emitDone(deps: RowDeps, call: Call, claims?: number): void {
  deps.emit({
    type: "call.done",
    sessionId: deps.sessionId,
    callId: call.id,
    durationMs: call.durationMs ?? 0,
    searches: call.searches,
    ...(claims === undefined ? {} : { claims }),
  });
}
