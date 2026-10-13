import { getRequestDb } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { appendEvent } from "@/lib/repos/events";
import { answersTextForSession, indexSession } from "@/lib/repos/search";
import { restoreSession } from "@/lib/repos/sessions";

export const dynamic = "force-dynamic";

export const POST = defineRoute({ op: "settings_write" }, ({ ctx, params }) => {
  const db = getRequestDb();
  const id = params.id ?? "";
  const session = restoreSession(db, ctx.userId, id);
  if (!session) throw errors.notFound();
  indexSession(db, id, session.question, answersTextForSession(db, id));
  appendEvent(db, { sessionId: id, userId: ctx.userId, type: "restored" });
  return session;
});
