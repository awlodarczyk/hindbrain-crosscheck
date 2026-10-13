import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { PROVIDER_IDS, type ProviderId, type RunReason, type SessionStatus } from "@/lib/db/enums";
import { sessions } from "@/lib/db/schema";
import { getCall, listCalls } from "@/lib/repos/calls";
import { createRun, finishRun, latestRun, setRunStatus } from "@/lib/repos/runs";
import { recomputeStats, setSessionStatus } from "@/lib/repos/sessions";
import { deriveSessionStatus } from "@/lib/repos/stats";
import type { Run } from "@/lib/repos/types";
import type { Provider } from "@/lib/providers/types";
import type { Settings } from "@/lib/settings/schema";
import { runColumn, type ColumnPlan } from "./column";
import type { EmitFn } from "./events";
import { resolveModels } from "./resolve-models";

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
type Prepared = { run: Run; plans: readonly ColumnPlan[] };
type SessionRow = typeof sessions.$inferSelect;

const other = (p: ProviderId): ProviderId => (p === "claude" ? "chatgpt" : "claude");

function loadSession(db: Db, id: string): SessionRow {
  const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!row) throw new Error(`session not found: ${id}`);
  return row;
}

/** New run with one column per provider; in paste mode only providers with a pasted answer run. */
function planFresh(deps: RunDeps, session: SessionRow, opts: RunOptions): Prepared {
  const run = createRun(deps.db, session.id, opts.reason, deps.now);
  const plans = PROVIDER_IDS.flatMap((answerer): ColumnPlan[] => {
    const pastedAnswer = opts.pasted?.[answerer] || undefined;
    if (session.mode === "paste" && pastedAnswer === undefined) return [];
    return [{ answerer, reviewer: other(answerer), pastedAnswer }];
  });
  return { run, plans };
}

/** Re-runs one call of the latest run in place; a retried answer also re-runs its review. */
function planRetry(db: Db, sessionId: string, callId: string): Prepared {
  const call = getCall(db, callId);
  const run = latestRun(db, sessionId);
  if (!call || !run || call.runId !== run.id) {
    throw new Error(`call ${callId} is not part of the latest run of session ${sessionId}`);
  }
  const calls = listCalls(db, run.id);
  const find = (kind: string, provider: ProviderId) =>
    calls.find((c) => c.kind === kind && c.provider === provider)?.id;
  const plan: ColumnPlan =
    call.kind === "answer"
      ? {
          answerer: call.provider,
          reviewer: other(call.provider),
          only: "answer",
          existing: { answerCallId: call.id, reviewCallId: find("review", other(call.provider)) },
        }
      : {
          answerer: other(call.provider),
          reviewer: call.provider,
          only: "review",
          existing: { answerCallId: find("answer", other(call.provider)), reviewCallId: call.id },
        };
  return { run, plans: [plan] };
}

function finalize(deps: RunDeps, sessionId: string, runId: string): RunOutcome {
  const stats = recomputeStats(deps.db, sessionId, deps.now);
  const status = deriveSessionStatus(listCalls(deps.db, runId));
  finishRun(deps.db, runId, status, deps.now);
  setSessionStatus(deps.db, sessionId, status, deps.now);
  return { status, disputed: stats.disputed, runId };
}

/**
 * Runs (or retries part of) a cross-check for a session: both columns in parallel, each answer
 * reviewed by the other provider. Internal: does not check ownership. Always emits
 * `session.done`, also when calls fail or the signal aborts.
 *
 * @throws when the session is missing or `retryCallId` is not a call of the latest run.
 */
export async function runSession(
  deps: RunDeps,
  sessionId: string,
  opts: RunOptions,
): Promise<RunOutcome> {
  const { db, providers, emit } = deps;
  const session = loadSession(db, sessionId);
  const models = resolveModels(deps.settings, {
    claude: providers.claude.transport,
    chatgpt: providers.chatgpt.transport,
  });
  const { run, plans } = opts.retryCallId
    ? planRetry(db, sessionId, opts.retryCallId)
    : planFresh(deps, session, opts);
  setRunStatus(db, run.id, "running");
  setSessionStatus(db, sessionId, "running", deps.now);
  emit({ type: "run.started", sessionId, runId: run.id, attempt: run.attempt });
  const column = {
    ...{ db, providers, settings: deps.settings, models, emit, now: deps.now },
    ...{ sessionId, runId: run.id, question: session.question },
    signal: deps.signal ?? new AbortController().signal,
  };
  let outcome: RunOutcome = { status: "failed", disputed: 0, runId: run.id };
  try {
    await Promise.allSettled(plans.map((plan) => runColumn(column, plan)));
    outcome = finalize(deps, sessionId, run.id);
  } finally {
    emit({ type: "session.done", sessionId, status: outcome.status, disputed: outcome.disputed });
  }
  return outcome;
}
