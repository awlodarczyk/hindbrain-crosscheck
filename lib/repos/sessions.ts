import { and, desc, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { ulid } from "ulid";
import { z } from "zod";
import type { SessionMode, SessionStatus } from "@/lib/db/enums";
import type { Db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { listCalls } from "./calls";
import { listClaimsForCalls } from "./claims";
import { latestRun } from "./runs";
import { computeStats, deriveSessionStatus } from "./stats";
import { EMPTY_STATS, type Session, type SessionStats } from "./types";

type Row = typeof sessions.$inferSelect;
type Now = () => Date;
const defaultNow: Now = () => new Date();

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const statsSchema = z.object({
  claims: z.number(),
  supported: z.number(),
  disputed: z.number(),
  partial: z.number(),
  unverifiable: z.number(),
  calls: z.number(),
  callsDone: z.number(),
  searches: z.number(),
  durationMs: z.number(),
  costUsd: z.number().nullable(),
});

function parseStats(raw: string): SessionStats {
  const parsed = statsSchema.partial().safeParse(parseJson(raw));
  return parsed.success ? Object.freeze({ ...EMPTY_STATS, ...parsed.data }) : EMPTY_STATS;
}

const toSession = (r: Row): Session =>
  Object.freeze({
    ...r,
    settingsSnapshot: parseJson(r.settingsSnapshot),
    stats: parseStats(r.stats),
  });

const owned = (userId: string, id: string) => and(eq(sessions.userId, userId), eq(sessions.id, id));

export function createSession(
  db: Db,
  input: {
    userId: string;
    question: string;
    mode: SessionMode;
    settingsSnapshot: unknown;
    title?: string;
  },
  now: Now = defaultNow,
): Session {
  const ts = now().toISOString();
  const row = db
    .insert(sessions)
    .values({
      id: ulid(),
      userId: input.userId,
      question: input.question,
      title: input.title ?? null,
      mode: input.mode,
      status: "queued",
      settingsSnapshot: JSON.stringify(input.settingsSnapshot ?? null),
      stats: JSON.stringify(EMPTY_STATS),
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    })
    .returning()
    .get();
  return toSession(row);
}

export function getSession(db: Db, userId: string, id: string): Session | null {
  const row = db
    .select()
    .from(sessions)
    .where(and(owned(userId, id), isNull(sessions.deletedAt)))
    .get();
  return row ? toSession(row) : null;
}

export type ListCursor = { createdAt: string; id: string };

/** Newest first, ordered by (createdAt, id); `before` is an exclusive keyset cursor. */
export function listSessions(
  db: Db,
  userId: string,
  opts: { limit: number; before?: ListCursor },
): readonly Session[] {
  const rows = db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.deletedAt),
        opts.before
          ? or(
              lt(sessions.createdAt, opts.before.createdAt),
              and(eq(sessions.createdAt, opts.before.createdAt), lt(sessions.id, opts.before.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(sessions.createdAt), desc(sessions.id))
    .limit(opts.limit)
    .all();
  return Object.freeze(rows.map(toSession));
}

export function listDeletedSessions(db: Db, userId: string): readonly Session[] {
  const rows = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNotNull(sessions.deletedAt)))
    .orderBy(desc(sessions.deletedAt))
    .all();
  return Object.freeze(rows.map(toSession));
}

export function renameSession(
  db: Db,
  userId: string,
  id: string,
  title: string,
  now: Now = defaultNow,
): Session | null {
  const row = db
    .update(sessions)
    .set({ title, updatedAt: now().toISOString() })
    .where(and(owned(userId, id), isNull(sessions.deletedAt)))
    .returning()
    .get();
  return row ? toSession(row) : null;
}

export function softDeleteSession(
  db: Db,
  userId: string,
  id: string,
  now: Now = defaultNow,
): boolean {
  const ts = now().toISOString();
  const rows = db
    .update(sessions)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(owned(userId, id), isNull(sessions.deletedAt)))
    .returning({ id: sessions.id })
    .all();
  return rows.length > 0;
}

export function restoreSession(
  db: Db,
  userId: string,
  id: string,
  now: Now = defaultNow,
): Session | null {
  const row = db
    .update(sessions)
    .set({ deletedAt: null, updatedAt: now().toISOString() })
    .where(and(owned(userId, id), isNotNull(sessions.deletedAt)))
    .returning()
    .get();
  return row ? toSession(row) : null;
}

/**
 * Internal pipeline function keyed by session id only; call it after the caller has verified
 * ownership of the session.
 */
export function setSessionStatus(
  db: Db,
  id: string,
  status: SessionStatus,
  now: Now = defaultNow,
): void {
  db.update(sessions)
    .set({ status, updatedAt: now().toISOString() })
    .where(eq(sessions.id, id))
    .run();
}

/**
 * Recomputes stats and status from the latest run's calls and claims, and persists them.
 * Internal pipeline function keyed by session id only; call it after the caller has verified
 * ownership of the session.
 */
export function recomputeStats(db: Db, id: string, now: Now = defaultNow): SessionStats {
  // better-sqlite3 runs the callback synchronously on the single connection, so db.* calls inside are part of the transaction.
  return db.transaction(() => {
    const run = latestRun(db, id);
    const calls = run ? listCalls(db, run.id) : [];
    const stats = computeStats(
      calls,
      listClaimsForCalls(
        db,
        calls.map((c) => c.id),
      ),
    );
    db.update(sessions)
      .set({
        stats: JSON.stringify(stats),
        status: deriveSessionStatus(calls),
        updatedAt: now().toISOString(),
      })
      .where(eq(sessions.id, id))
      .run();
    return stats;
  });
}

/** Soft-deletes every live session of the user and returns their ids. */
export function softDeleteAllSessions(db: Db, userId: string, now: Now = defaultNow): string[] {
  const ts = now().toISOString();
  return db
    .update(sessions)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(sessions.userId, userId), isNull(sessions.deletedAt)))
    .returning({ id: sessions.id })
    .all()
    .map((r) => r.id);
}
