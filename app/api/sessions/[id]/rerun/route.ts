import { getRequestDb, getRequestRunner } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { appendEvent } from "@/lib/repos/events";
import { pastedFromLatestRun } from "@/lib/pipeline/run-plan";
import { getSession } from "@/lib/repos/sessions";

export const dynamic = "force-dynamic";

export const POST = defineRoute({ op: "rerun" }, ({ ctx, params }) => {
  const db = getRequestDb();
  const runner = getRequestRunner();
  const id = params.id ?? "";
  const session = getSession(db, ctx.userId, id);
  if (!session) throw errors.notFound();
  const busy = session.status === "running" || session.status === "queued";
  if (busy || runner.active().includes(id)) throw alreadyRunning();
  if (session.mode === "paste") {
    try {
      pastedFromLatestRun(db, id);
    } catch {
      throw errors.conflict("not_rerunnable", "This paste session has no pasted answers to re-run.");
    }
  }
  if (!runner.enqueue({ sessionId: id, userId: ctx.userId, reason: "manual" }).queued) {
    throw alreadyRunning();
  }
  appendEvent(db, { sessionId: id, userId: ctx.userId, type: "rerun" });
  return { id, queued: true };
});

function alreadyRunning() {
  return errors.conflict("already_running", "This session is already running.");
}
