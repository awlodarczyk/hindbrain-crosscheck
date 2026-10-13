import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import type { RunStatus } from "@/lib/db/enums";
import { calls, runs, sessions } from "@/lib/db/schema";
import { listCalls } from "@/lib/repos/calls";
import { recomputeStats } from "@/lib/repos/sessions";
import { deriveSessionStatus } from "@/lib/repos/stats";

const IN_FLIGHT = ["running", "queued"] as const;
const INTERRUPTED_MESSAGE = "The app restarted while this call was running. Retry.";

/** Run status derived from its calls; a run that never started a call counts as failed. */
function derivedRunStatus(db: Db, runId: string): RunStatus {
  const status = deriveSessionStatus(listCalls(db, runId));
  return status === "queued" ? "failed" : status;
}

/**
 * Marks calls left running/queued by a previous process as failed("interrupted") and re-derives
 * the status of their runs and sessions. Returns how many calls and sessions were touched.
 */
export function sweepInterrupted(db: Db, now: Date): { calls: number; sessions: number } {
  return db.transaction(() => {
    const failedCalls = db
      .update(calls)
      .set({
        status: "failed",
        errorCode: "interrupted",
        errorMessage: INTERRUPTED_MESSAGE,
        finishedAt: now.toISOString(),
      })
      .where(inArray(calls.status, IN_FLIGHT))
      .returning({ id: calls.id })
      .all();
    const staleRuns = db.select().from(runs).where(inArray(runs.status, IN_FLIGHT)).all();
    for (const run of staleRuns) {
      db.update(runs)
        .set({ status: derivedRunStatus(db, run.id), finishedAt: now.toISOString() })
        .where(eq(runs.id, run.id))
        .run();
    }
    const staleSessions = db
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.status, IN_FLIGHT))
      .all();
    for (const s of staleSessions) {
      recomputeStats(db, s.id, () => now);
      db.update(sessions)
        .set({ status: "failed" })
        .where(and(eq(sessions.id, s.id), eq(sessions.status, "queued")))
        .run();
    }
    return { calls: failedCalls.length, sessions: staleSessions.length };
  });
}
