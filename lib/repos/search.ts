import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { escapeFtsQuery } from "@/lib/db/fts";
import { listCalls } from "./calls";
import { latestRun } from "./runs";

export type SearchHit = { id: string; question: string; snippet: string; createdAt: string };

type Row = {
  id: string;
  question: string;
  created_at: string;
  answer_snippet: string;
  question_snippet: string;
};

/** Removes any index row for the session. */
export function removeFromIndex(db: Db, sessionId: string): void {
  db.run(sql`delete from sessions_fts where session_id = ${sessionId}`);
}

/** Replaces the session's index row with the given question and concatenated answers text. */
export function indexSession(
  db: Db,
  sessionId: string,
  question: string,
  answersText: string,
): void {
  removeFromIndex(db, sessionId);
  db.run(
    sql`insert into sessions_fts (session_id, question, answers) values (${sessionId}, ${question}, ${answersText})`,
  );
}

/**
 * Full-text search over a user's non-deleted sessions, best match first.
 * The query is escaped into quoted phrases and bound as a parameter; blank queries return [].
 * `snippet` contains only `<mark>`/`</mark>` markup around otherwise unescaped text:
 * the UI must HTML-escape everything except the mark tags.
 */
export function searchSessions(
  db: Db,
  userId: string,
  q: string,
  limit = 20,
): readonly SearchHit[] {
  const match = escapeFtsQuery(q);
  if (match === "") return [];
  const rows = db.all<Row>(sql`
    select s.id as id, s.question as question, s.created_at as created_at,
      snippet(sessions_fts, 2, '<mark>', '</mark>', '…', 12) as answer_snippet,
      snippet(sessions_fts, 1, '<mark>', '</mark>', '…', 12) as question_snippet
    from sessions_fts f join sessions s on s.id = f.session_id
    where sessions_fts match ${match} and s.user_id = ${userId} and s.deleted_at is null
    order by bm25(sessions_fts) limit ${limit}`);
  return rows.map((r) => ({
    id: r.id,
    question: r.question,
    createdAt: r.created_at,
    snippet: r.answer_snippet.includes("<mark>") ? r.answer_snippet : r.question_snippet,
  }));
}

/** Joins non-empty answer texts with blank lines, the form stored in the index. */
export function joinAnswerTexts(texts: readonly (string | null)[]): string {
  return texts.filter((t): t is string => !!t).join("\n\n");
}

/** Answer texts of the session's latest run, joined for full-text indexing. */
export function answersTextForSession(db: Db, sessionId: string): string {
  const run = latestRun(db, sessionId);
  if (!run) return "";
  return joinAnswerTexts(
    listCalls(db, run.id)
      .filter((c) => c.kind === "answer" && c.status === "done")
      .map((c) => c.text),
  );
}
