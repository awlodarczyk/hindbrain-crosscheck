import { z } from "zod";
import { getRequestDb } from "@/lib/http/deps";
import { HttpError } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { ExportError, fromExport } from "@/lib/pipeline/export-schema";
import { costForBody } from "@/lib/rate-limit/weights";
import { appendEvent } from "@/lib/repos/events";
import { bundleAnswersText, importBundle } from "@/lib/repos/import";
import { indexSession } from "@/lib/repos/search";

export const dynamic = "force-dynamic";

export const POST = defineRoute(
  {
    op: ({ bodyBytes }) => costForBody("paste_import_per_10kb", bodyBytes),
    body: z.unknown(),
    maxBodyBytes: 2_097_152,
    contentType: "application/json",
  },
  ({ ctx, body }) => {
    const db = getRequestDb();
    try {
      const { bundles, warnings } = fromExport(body);
      const ids = db.transaction(() =>
        bundles.map((b) => {
          const id = importBundle(db, ctx.userId, b);
          indexSession(db, id, b.session.question, bundleAnswersText(b));
          return id;
        }),
      );
      appendEvent(db, {
        sessionId: null,
        userId: ctx.userId,
        type: "import",
        payload: { count: ids.length, warnings },
      });
      return { imported: ids.length, ids, warnings };
    } catch (e) {
      if (e instanceof ExportError)
        throw new HttpError(400, "invalid_export_file", "Export file is invalid.", e.message);
      throw e;
    }
  },
);
