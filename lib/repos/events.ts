import { and, asc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "@/lib/db/client";
import { deepFreeze } from "@/lib/settings/freeze";
import { events } from "@/lib/db/schema-sessions";

export type AppEvent = {
  id: string;
  sessionId: string | null;
  userId: string;
  ts: string;
  type: string;
  payload: unknown;
};

type Row = typeof events.$inferSelect;

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function toEvent(row: Row): AppEvent {
  return deepFreeze({ ...row, payload: parsePayload(row.payload) });
}

const freezeAll = (rows: Row[]): readonly AppEvent[] => Object.freeze(rows.map(toEvent));

export function appendEvent(
  db: Db,
  input: { sessionId: string | null; userId: string; type: string; payload?: unknown },
  now: () => Date = () => new Date(),
): AppEvent {
  const row: Row = {
    id: ulid(),
    sessionId: input.sessionId,
    userId: input.userId,
    ts: now().toISOString(),
    type: input.type,
    payload: JSON.stringify(input.payload ?? null),
  };
  db.insert(events).values(row).run();
  return toEvent(row);
}

/** Events of a session, oldest first. */
export function listEvents(db: Db, sessionId: string, limit = 100): readonly AppEvent[] {
  return freezeAll(
    db
      .select()
      .from(events)
      .where(eq(events.sessionId, sessionId))
      .orderBy(asc(events.ts))
      .limit(limit)
      .all(),
  );
}

/** A user's events of one type, oldest first. */
export function listUserEvents(
  db: Db,
  userId: string,
  type: string,
  limit = 100,
): readonly AppEvent[] {
  return freezeAll(
    db
      .select()
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.type, type)))
      .orderBy(asc(events.ts))
      .limit(limit)
      .all(),
  );
}
