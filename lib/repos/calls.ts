import { asc, eq, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { calls, runs } from "@/lib/db/schema";
import type { Call, Citation, NewCall } from "./types";

type Row = typeof calls.$inferSelect;
const rowid = sql`calls.rowid`;

const citationsSchema = z.array(z.object({ title: z.string(), url: z.string() }));

function parseCitations(raw: string): readonly Citation[] {
  try {
    const parsed = citationsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? Object.freeze(parsed.data.map((c) => Object.freeze(c))) : [];
  } catch {
    return [];
  }
}

const toCall = (r: Row): Call => Object.freeze({ ...r, citations: parseCitations(r.citations) });

const toRow = (c: Partial<Call>): Partial<Row> => {
  const { citations, ...rest } = c;
  return citations === undefined ? rest : { ...rest, citations: JSON.stringify(citations) };
};

/** Inserts a call with status "queued" and null/zero defaults for unset fields. */
export function createCall(db: Db, input: NewCall): Call {
  const row = db
    .insert(calls)
    .values({
      ...input,
      id: ulid(),
      status: input.status ?? "queued",
      citations: JSON.stringify(input.citations ?? []),
    })
    .returning()
    .get();
  return toCall(row);
}

/** Applies a partial update and returns the merged row. Throws when the call does not exist. */
export function updateCall(db: Db, id: string, patch: Partial<Omit<Call, "id" | "runId">>): Call {
  const set = toRow(patch);
  if (Object.keys(set).length > 0) db.update(calls).set(set).where(eq(calls.id, id)).run();
  const found = getCall(db, id);
  if (!found) throw new Error(`call not found: ${id}`);
  return found;
}

export function getCall(db: Db, id: string): Call | null {
  const row = db.select().from(calls).where(eq(calls.id, id)).get();
  return row ? toCall(row) : null;
}

export function listCalls(db: Db, runId: string): readonly Call[] {
  const rows = db.select().from(calls).where(eq(calls.runId, runId)).orderBy(asc(rowid)).all();
  return Object.freeze(rows.map(toCall));
}

export function listCallsForSession(db: Db, sessionId: string): readonly Call[] {
  const rows = db
    .select({ call: calls })
    .from(calls)
    .innerJoin(runs, eq(calls.runId, runs.id))
    .where(eq(runs.sessionId, sessionId))
    .orderBy(asc(runs.attempt), asc(rowid))
    .all();
  return Object.freeze(rows.map((r) => toCall(r.call)));
}
