import { loadBundle, RenameBody } from "@/lib/api/sessions-dto";
import { getRequestDb } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { appendEvent } from "@/lib/repos/events";
import { removeFromIndex } from "@/lib/repos/search";
import { renameSession, softDeleteSession } from "@/lib/repos/sessions";

export const dynamic = "force-dynamic";

export const GET = defineRoute({ op: "read" }, ({ ctx, params }) => {
  const bundle = loadBundle(getRequestDb(), ctx.userId, params.id ?? "");
  if (!bundle) throw errors.notFound();
  return bundle;
});

export const PATCH = defineRoute(
  { op: "settings_write", body: RenameBody },
  ({ ctx, params, body }) => {
    const db = getRequestDb();
    const session = renameSession(db, ctx.userId, params.id ?? "", body.title);
    if (!session) throw errors.notFound();
    appendEvent(db, {
      sessionId: session.id,
      userId: ctx.userId,
      type: "renamed",
      payload: { title: body.title },
    });
    return session;
  },
);

export const DELETE = defineRoute({ op: "settings_write" }, ({ ctx, params }) => {
  const db = getRequestDb();
  const id = params.id ?? "";
  if (!softDeleteSession(db, ctx.userId, id)) throw errors.notFound();
  removeFromIndex(db, id);
  appendEvent(db, { sessionId: id, userId: ctx.userId, type: "deleted" });
  return { id };
});
