import { z } from "zod";
import { loadBundle } from "@/lib/api/sessions-dto";
import { getRequestDb } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { toExport } from "@/lib/pipeline/export-schema";
import { buildMarkdownReport } from "@/lib/pipeline/report";

export const dynamic = "force-dynamic";

const ExportQuery = z.object({ format: z.enum(["json", "md"]).default("json") });

const attachment = (body: string, type: string, filename: string) =>
  new Response(body, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });

export const GET = defineRoute({ op: "read", query: ExportQuery }, ({ ctx, params, query }) => {
  const id = params.id ?? "";
  const bundle = loadBundle(getRequestDb(), ctx.userId, id);
  if (!bundle) throw errors.notFound();
  if (query.format === "md") {
    return attachment(
      buildMarkdownReport(bundle, { now: ctx.now }),
      "text/markdown; charset=utf-8",
      `crosscheck-${id}.md`,
    );
  }
  return attachment(
    JSON.stringify(toExport([bundle], ctx.now)),
    "application/json",
    `crosscheck-${id}.json`,
  );
});
