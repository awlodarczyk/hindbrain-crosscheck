export type SseOptions = {
  /** Sent first as `event: snapshot`. */
  snapshot: unknown;
  /** Called before the snapshot is written; events sent meanwhile are buffered and flushed after it. Returns an unsubscribe. */
  subscribe: (send: (event: string, data: unknown, id?: number) => void) => () => void;
  /** Sent after the snapshot and before live events; live events with an already-sent id are dropped. */
  replay?: readonly { id: number; event: string; data: unknown }[];
  heartbeatMs?: number;
  signal: AbortSignal;
  /** Defaults to `event === "session.done"`; once it fires the stream closes after `graceMs`. */
  closeOn?: (event: string, data: unknown) => boolean;
  graceMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
};

const DEFAULT_HEARTBEAT_MS = 15_000;
const DEFAULT_GRACE_MS = 1_000;
const HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-store",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

type Pending = { event: string; data: unknown; id?: number };

const frame = (event: string, data: unknown, id?: number): string =>
  `${id === undefined ? "" : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Builds a Server-Sent Events response: snapshot, replay, live events, heartbeats; closes on abort or `closeOn`. */
export function createSseResponse(opts: SseOptions): Response {
  const setT = opts.setTimeoutFn ?? setTimeout;
  const clearT = opts.clearTimeoutFn ?? clearTimeout;
  const closeOn = opts.closeOn ?? ((event: string) => event === "session.done");
  const encoder = new TextEncoder();
  let cleanup = (): void => undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const seen = new Set<number>();
      const buffer: Pending[] = [];
      let ready = false;
      let finished = false;
      let unsubscribe: () => void = () => undefined;
      let heartbeat: ReturnType<typeof setTimeout> | undefined;
      let grace: ReturnType<typeof setTimeout> | undefined;

      const finish = (): void => {
        if (finished) return;
        finished = true;
        clearT(heartbeat);
        clearT(grace);
        opts.signal.removeEventListener("abort", finish);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed or errored by the consumer
        }
      };
      cleanup = finish;

      const write = (text: string): boolean => {
        if (finished) return false;
        try {
          controller.enqueue(encoder.encode(text));
          return true;
        } catch {
          finish();
          return false;
        }
      };

      const emit = ({ event, data, id }: Pending): void => {
        if (id !== undefined) {
          if (seen.has(id)) return;
          seen.add(id);
        }
        if (!write(frame(event, data, id))) return;
        if (grace === undefined && closeOn(event, data)) {
          grace = setT(finish, opts.graceMs ?? DEFAULT_GRACE_MS);
        }
      };

      const beat = (): void => {
        if (!write(": ping\n\n")) return;
        heartbeat = setT(beat, opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
      };

      if (opts.signal.aborted) return finish();
      opts.signal.addEventListener("abort", finish, { once: true });
      unsubscribe = opts.subscribe((event, data, id) => {
        if (ready) emit({ event, data, id });
        else buffer.push({ event, data, id });
      });
      if (finished) unsubscribe();
      write(frame("snapshot", opts.snapshot));
      ready = true;
      for (const r of opts.replay ?? []) emit(r);
      for (const b of buffer) emit(b);
      heartbeat = setT(beat, opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, { headers: HEADERS });
}

/** Reads the `Last-Event-ID` header; undefined unless it is an integer >= 0. */
export function parseLastEventId(req: Request): number | undefined {
  const raw = req.headers.get("last-event-id");
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : undefined;
}
