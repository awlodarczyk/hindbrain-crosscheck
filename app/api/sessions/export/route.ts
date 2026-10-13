import { loadBundle } from "@/lib/api/sessions-dto";
import { getRequestDb } from "@/lib/http/deps";
import { defineRoute } from "@/lib/http/route";
import { toExport } from "@/lib/pipeline/export-schema";
import { listSessions, type ListCursor } from "@/lib/repos/sessions";
import type { Session } from "@/lib/repos/types";

export const dynamic = "force-dynamic";

const PAGE = 100;

function allSessions(userId: string): Session[] {
  const db = getRequestDb();
  const all: Session[] = [];
  for (let before: ListCursor | undefined; ;) {
    const page = listSessions(db, userId, { limit: PAGE, before });
    all.push(...page);
    if (page.length < PAGE) return all;
    const last = page[page.length - 1];
    before = last && { createdAt: last.createdAt, id: last.id };
  }
}

export const GET = defineRoute({ op: "read" }, ({ ctx }) => {
  const db = getRequestDb();
  const bundles = allSessions(ctx.userId).flatMap((s) => loadBundle(db, ctx.userId, s.id) ?? []);
  const date = ctx.now.toISOString().slice(0, 10);
  return new Response(JSON.stringify(toExport(bundles, ctx.now)), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="crosscheck-all-${date}.json"`,
    },
  });
});
