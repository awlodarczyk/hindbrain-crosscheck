import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { PROVIDER_IDS, type ProviderId } from "@/lib/db/enums";
import { sessions } from "@/lib/db/schema";
import { getCall, listCalls } from "@/lib/repos/calls";
import { createRun, latestRun } from "@/lib/repos/runs";
import type { Run } from "@/lib/repos/types";
import type { ColumnPlan } from "./column";
import type { RunOptions } from "./run-session";

export type Prepared = { run: Run; plans: readonly ColumnPlan[] };
export type SessionRow = typeof sessions.$inferSelect;

const other = (p: ProviderId): ProviderId => (p === "claude" ? "chatgpt" : "claude");

/** Loads a session row by id regardless of owner. @throws when missing. */
export function loadSession(db: Db, id: string): SessionRow {
  const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!row) throw new Error(`session not found: ${id}`);
  return row;
}

/** Pasted answers of the session's latest run, by provider. @throws when there are none. */
export function pastedFromLatestRun(
  db: Db,
  sessionId: string,
): Partial<Record<ProviderId, string>> {
  const prev = latestRun(db, sessionId);
  const pasted: Partial<Record<ProviderId, string>> = {};
  for (const c of prev ? listCalls(db, prev.id) : []) {
    if (c.kind === "answer" && c.pasted && c.text) pasted[c.provider] = c.text;
  }
  if (Object.keys(pasted).length === 0) throw new Error("paste session has no pasted answers");
  return pasted;
}

/** New run with one column per provider; in paste mode only providers with a pasted answer run. */
export function planFresh(
  db: Db,
  session: SessionRow,
  opts: Pick<RunOptions, "reason" | "pasted">,
  now?: () => Date,
): Prepared {
  const pasted =
    opts.pasted ?? (session.mode === "paste" ? pastedFromLatestRun(db, session.id) : undefined);
  const run = createRun(db, session.id, opts.reason, now);
  const plans = PROVIDER_IDS.flatMap((answerer): ColumnPlan[] => {
    const pastedAnswer = pasted?.[answerer] || undefined;
    if (session.mode === "paste" && pastedAnswer === undefined) return [];
    return [{ answerer, reviewer: other(answerer), pastedAnswer }];
  });
  return { run, plans };
}

/**
 * Re-runs one call of the latest run in place; a retried answer also re-runs its review.
 * Pasted answers cannot be retried (their review can).
 */
export function planRetry(db: Db, sessionId: string, callId: string): Prepared {
  const call = getCall(db, callId);
  const run = latestRun(db, sessionId);
  if (!call || !run || call.runId !== run.id) {
    throw new Error(`call ${callId} is not part of the latest run of session ${sessionId}`);
  }
  if (call.kind === "answer" && call.pasted) throw new Error("pasted answers are not retryable");
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
