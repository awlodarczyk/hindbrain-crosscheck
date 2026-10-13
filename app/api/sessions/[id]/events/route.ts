import { loadBundle } from "@/lib/api/sessions-dto";
import { getRequestBus, getRequestDb } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { createSseResponse, parseLastEventId } from "@/lib/http/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TERMINAL = new Set(["done", "partial", "failed"]);

/**
 * Streams a snapshot followed by live run events; events are replayed only when `Last-Event-ID` is sent. When the session already finished and
 * replay does not contain `session.done`, a synthetic `session.done` carrying the current
 * status is sent right after the snapshot so clients close.
 */
export const GET = defineRoute({ op: "read" }, ({ ctx, params, req }) => {
  const id = params.id ?? "";
  const bundle = loadBundle(getRequestDb(), ctx.userId, id);
  if (!bundle) throw errors.notFound();
  const bus = getRequestBus();
  const afterId = parseLastEventId(req);
  const replay =
    afterId === undefined
      ? []
      : bus.replay(id, afterId).map((e) => ({ id: e.id, event: e.type, data: e }));
  const needsDone =
    TERMINAL.has(bundle.session.status) && !replay.some((r) => r.event === "session.done");
  return createSseResponse({
    snapshot: bundle,
    replay,
    signal: req.signal,
    subscribe: (send) => {
      if (needsDone) {
        send("session.done", {
          type: "session.done",
          sessionId: id,
          status: bundle.session.status,
          disputed: bundle.session.stats?.disputed ?? 0,
        });
      }
      return bus.subscribe(id, (e) => send(e.type, e, e.id));
    },
  });
});
