import { NextResponse } from "next/server";
import { CreateSessionBody, DeleteAllBody, ListQuery, toListItem } from "@/lib/api/sessions-dto";
import { getRequestDb, getRequestRunner } from "@/lib/http/deps";
import { ok } from "@/lib/http/envelope";
import { defineRoute } from "@/lib/http/route";
import { costForBody } from "@/lib/rate-limit/weights";
import { appendEvent } from "@/lib/repos/events";
import { indexSession, removeFromIndex } from "@/lib/repos/search";
import { createSession, listSessions, softDeleteAllSessions } from "@/lib/repos/sessions";
import { getSettings } from "@/lib/repos/settings";
import { mergeSettings } from "@/lib/settings/merge";

export const dynamic = "force-dynamic";

export const GET = defineRoute({ op: "read", query: ListQuery }, ({ ctx, query }) => {
  const items = listSessions(getRequestDb(), ctx.userId, query).map(toListItem);
  return NextResponse.json(ok(items, { total: items.length, page: 1, limit: query.limit }));
});

/** Trims pasted answers and drops empty ones. */
function trimPasted(pasted: { claude?: string; chatgpt?: string } | undefined): {
  claude?: string;
  chatgpt?: string;
} {
  const out: { claude?: string; chatgpt?: string } = {};
  for (const id of ["claude", "chatgpt"] as const) {
    const t = pasted?.[id]?.trim();
    if (t) out[id] = t;
  }
  return out;
}

/** Ask costs a flat `ask`; bodies over 20 kB (paste imports) are weighted by size. */
const createCost = ({ bodyBytes }: { bodyBytes: number }) =>
  bodyBytes > 20_000 ? costForBody("paste_import_per_10kb", bodyBytes) : costForBody("ask");

export const POST = defineRoute(
  { op: createCost, body: CreateSessionBody, maxBodyBytes: 500_000 },
  ({ ctx, body }) => {
    const db = getRequestDb();
    const base = getSettings(db, ctx.userId);
    const settingsSnapshot = mergeSettings(base, body.overrides ?? {}).settings;
    const { id } = createSession(db, {
      userId: ctx.userId,
      question: body.question,
      mode: body.mode,
      settingsSnapshot,
    });
    indexSession(db, id, body.question, "");
    appendEvent(db, {
      sessionId: id,
      userId: ctx.userId,
      type: "created",
      payload: { mode: body.mode },
    });
    getRequestRunner().enqueue({
      sessionId: id,
      userId: ctx.userId,
      reason: "initial",
      pasted: body.mode === "paste" ? trimPasted(body.pasted) : undefined,
    });
    return NextResponse.json(ok({ id }), { status: 201 });
  },
);

export const DELETE = defineRoute({ op: "settings_write", body: DeleteAllBody }, ({ ctx }) => {
  const db = getRequestDb();
  const ids = db.transaction(() => {
    const deleted = softDeleteAllSessions(db, ctx.userId);
    deleted.forEach((id) => removeFromIndex(db, id));
    return deleted;
  });
  appendEvent(db, {
    sessionId: null,
    userId: ctx.userId,
    type: "delete_all",
    payload: { count: ids.length },
  });
  return { deleted: ids.length };
});
