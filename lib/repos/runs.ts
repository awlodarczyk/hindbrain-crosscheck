import { desc, eq, max } from "drizzle-orm";
import { ulid } from "ulid";
import type { RunReason, RunStatus } from "@/lib/db/enums";
import type { Db } from "@/lib/db/client";
import { runs } from "@/lib/db/schema";
import type { Run } from "./types";

type Row = typeof runs.$inferSelect;
const toRun = (r: Row): Run => Object.freeze({ ...r });

/** Creates a queued run whose attempt is one above the session's highest. */
export function createRun(
  db: Db,
  sessionId: string,
  reason: RunReason,
  now = () => new Date(),
): Run {
  // better-sqlite3 runs the callback synchronously on the single connection, so db.* calls inside are part of the transaction.
  return db.transaction((tx) => {
    const top = tx
      .select({ n: max(runs.attempt) })
      .from(runs)
      .where(eq(runs.sessionId, sessionId))
      .get();
    const row = tx
      .insert(runs)
      .values({
        id: ulid(),
        sessionId,
        attempt: (top?.n ?? 0) + 1,
        reason,
        status: "queued",
        startedAt: now().toISOString(),
        finishedAt: null,
      })
      .returning()
      .get();
    return toRun(row);
  });
}

export function latestRun(db: Db, sessionId: string): Run | null {
  const row = db
    .select()
    .from(runs)
    .where(eq(runs.sessionId, sessionId))
    .orderBy(desc(runs.attempt))
    .limit(1)
    .get();
  return row ? toRun(row) : null;
}

export function listRuns(db: Db, sessionId: string): readonly Run[] {
  const rows = db
    .select()
    .from(runs)
    .where(eq(runs.sessionId, sessionId))
    .orderBy(runs.attempt)
    .all();
  return Object.freeze(rows.map(toRun));
}

export function finishRun(db: Db, id: string, status: RunStatus, now = () => new Date()): void {
  db.update(runs).set({ status, finishedAt: now().toISOString() }).where(eq(runs.id, id)).run();
}

export function setRunStatus(db: Db, id: string, status: RunStatus): void {
  db.update(runs).set({ status }).where(eq(runs.id, id)).run();
}

/** Inserts a run with an explicit attempt and timestamps (used by import). */
export function insertRun(db: Db, input: Omit<Run, "id">): Run {
  const row = db
    .insert(runs)
    .values({ ...input, id: ulid() })
    .returning()
    .get();
  return toRun(row);
}
