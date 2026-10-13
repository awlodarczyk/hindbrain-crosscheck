import type { Db } from "@/lib/db/client";
import type { ProviderId, RunReason, SessionStatus } from "@/lib/db/enums";
import { listCalls } from "@/lib/repos/calls";
import { finishRun, setRunStatus } from "@/lib/repos/runs";
import { answersTextForSession, indexSession } from "@/lib/repos/search";
import { recomputeStats, setSessionStatus } from "@/lib/repos/sessions";
import { deriveSessionStatus } from "@/lib/repos/stats";
import type { Provider } from "@/lib/providers/types";
import type { Settings } from "@/lib/settings/schema";
import { logError } from "./call-rows";
import { runColumn } from "./column";
import type { EmitFn } from "./events";
import { resolveModels } from "./resolve-models";
import { loadSession, planFresh, planRetry } from "./run-plan";

export type RunDeps = {
  db: Db;
  providers: Record<ProviderId, Provider>;
  settings: Settings;
  emit: EmitFn;
  signal?: AbortSignal;
  now?: () => Date;
};

/** `pasted` answers replace provider answers; `retryCallId` re-runs one call of the latest run. */
export type RunOptions = {
  reason: RunReason;
  pasted?: Partial<Record<ProviderId, string>>;
  retryCallId?: string;
};

export type RunOutcome = { status: SessionStatus; disputed: number; runId: string };
function safeEmitter(emit: EmitFn): EmitFn {
  return (e) => {
    try {
      emit(e);
    } catch (err) {
      logError(`emit ${e.type}`, err);
    }
  };
}

function markFailed(deps: RunDeps, sessionId: string, runId: string): void {
  const attempt = (what: string, write: () => void) => {
    try {
      write();
    } catch (e) {
      logError(`marking ${what} failed`, e);
    }
  };
  attempt("run", () => setRunStatus(deps.db, runId, "failed"));
  attempt("session", () => setSessionStatus(deps.db, sessionId, "failed", deps.now));
}

/** Persists the final run/session status; falls back to "failed" when that throws. */
function finalize(deps: RunDeps, sessionId: string, runId: string): RunOutcome {
  try {
    const stats = recomputeStats(deps.db, sessionId, deps.now);
    const status = deriveSessionStatus(listCalls(deps.db, runId));
    finishRun(deps.db, runId, status, deps.now);
    setSessionStatus(deps.db, sessionId, status, deps.now);
    return { status, disputed: stats.disputed, runId };
  } catch (e) {
    logError("finalize", e);
    markFailed(deps, sessionId, runId);
    return { status: "failed", disputed: 0, runId };
  }
}

/** Refreshes the full-text row so search finds the run's answers; failures are logged only. */
function reindex(deps: RunDeps, question: string, sessionId: string): void {
  try {
    indexSession(deps.db, sessionId, question, answersTextForSession(deps.db, sessionId));
  } catch (e) {
    logError("reindex", e);
  }
}

/**
 * Runs (or retries part of) a cross-check for a session: both columns in parallel, each answer
 * reviewed by the other provider. Internal: does not check ownership. Emitter errors are logged
 * and ignored. Once a run is chosen, `session.done` is always emitted, also when calls fail, the
 * signal aborts or persisting the run fails. A retry re-emits `run.started` with the same
 * attempt, so consumers must treat it idempotently.
 *
 * @throws when the session is missing, `retryCallId` is not a retryable call of the latest run,
 *   or the run cannot be started (after emitting `session.done` with status "failed").
 */
export async function runSession(
  deps: RunDeps,
  sessionId: string,
  opts: RunOptions,
): Promise<RunOutcome> {
  const { db, providers } = deps;
  const emit = safeEmitter(deps.emit);
  const session = loadSession(db, sessionId);
  const models = resolveModels(deps.settings, {
    claude: providers.claude.transport,
    chatgpt: providers.chatgpt.transport,
  });
  const { run, plans } = opts.retryCallId
    ? planRetry(db, sessionId, opts.retryCallId)
    : planFresh(db, session, opts, deps.now);
  try {
    setRunStatus(db, run.id, "running");
    setSessionStatus(db, sessionId, "running", deps.now);
    emit({ type: "run.started", sessionId, runId: run.id, attempt: run.attempt });
  } catch (e) {
    markFailed(deps, sessionId, run.id);
    emit({ type: "session.done", sessionId, status: "failed", disputed: 0 });
    throw e;
  }
  const column = {
    ...{ db, providers, settings: deps.settings, models, emit, now: deps.now },
    ...{ sessionId, runId: run.id, question: session.question },
    signal: deps.signal ?? new AbortController().signal,
  };
  await Promise.allSettled(plans.map((plan) => runColumn(column, plan)));
  const outcome = finalize(deps, sessionId, run.id);
  reindex(deps, session.question, sessionId);
  emit({ type: "session.done", sessionId, status: outcome.status, disputed: outcome.disputed });
  return outcome;
}
