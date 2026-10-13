import { ulid } from "ulid";
import type { Db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { ExportError, type ImportBundle } from "@/lib/pipeline/export-schema";
import { renderMarkdown } from "@/lib/security/sanitize";
import { createCall } from "./calls";
import { replaceClaims } from "./claims";
import { insertRun } from "./runs";

/** Atomically inserts one exported session under `userId` with fresh ids; returns the new session id. */
export function importBundle(db: Db, userId: string, bundle: ImportBundle): string {
  return db.transaction(() => {
    const id = ulid();
    const s = bundle.session;
    db.insert(sessions)
      .values({
        id,
        userId,
        question: s.question,
        title: s.title,
        mode: s.mode,
        status: s.status,
        settingsSnapshot: JSON.stringify(s.settingsSnapshot ?? null),
        stats: JSON.stringify(s.stats),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        deletedAt: null,
      })
      .run();
    const runIds = new Map(
      bundle.runs.map((r) => [r.attempt, insertRun(db, { ...r, sessionId: id }).id]),
    );
    for (const { attempt, claims, ...fields } of bundle.calls) {
      const runId = runIds.get(attempt);
      if (!runId) throw new ExportError(`call references missing run attempt ${attempt}`);
      const call = createCall(db, {
        ...fields,
        runId,
        html: fields.text ? renderMarkdown(fields.text) : null,
      });
      replaceClaims(db, call.id, claims);
    }
    return id;
  });
}

/** Concatenated answer texts of an import bundle's latest attempt, for full-text indexing. */
export function bundleAnswersText(bundle: ImportBundle): string {
  const latest = Math.max(0, ...bundle.runs.map((r) => r.attempt));
  return bundle.calls
    .filter((c) => c.attempt === latest && c.kind === "answer" && c.text)
    .map((c) => c.text)
    .join("\n\n");
}
