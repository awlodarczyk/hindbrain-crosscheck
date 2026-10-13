import { getRequestDb, getRequestRunner } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { getCall } from "@/lib/repos/calls";
import { appendEvent } from "@/lib/repos/events";
import { latestRun } from "@/lib/repos/runs";
import { getSession } from "@/lib/repos/sessions";

export const dynamic = "force-dynamic";

export const POST = defineRoute({ op: "retry" }, ({ ctx, params }) => {
  const db = getRequestDb();
  const runner = getRequestRunner();
  const id = params.id ?? "";
  const callId = params.callId ?? "";
  const session = getSession(db, ctx.userId, id);
  const call = session ? getCall(db, callId) : null;
  if (!session || !call || call.runId !== latestRun(db, id)?.id) throw errors.notFound();
  if (call.status !== "failed") {
    throw errors.conflict("not_failed", "Only failed calls can be retried.");
  }
  if (call.pasted && call.kind === "answer") {
    throw errors.conflict("not_retryable", "Pasted answers cannot be retried.");
  }
  const busy = session.status === "running" || session.status === "queued";
  const job = { sessionId: id, userId: ctx.userId, reason: "manual", retryCallId: callId } as const;
  if (busy || runner.active().includes(id) || !runner.enqueue(job).queued) {
    throw errors.conflict("already_running", "This session is already running.");
  }
  appendEvent(db, { sessionId: id, userId: ctx.userId, type: "retry", payload: { callId } });
  return { id, callId, queued: true };
});
