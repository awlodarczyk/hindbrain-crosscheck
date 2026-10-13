import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSseResponse, parseLastEventId, type SseOptions } from "./sse";

type Send = Parameters<SseOptions["subscribe"]>[0];

function reader(res: Response) {
  const r = res.body!.getReader();
  const dec = new TextDecoder();
  return {
    cancel: () => r.cancel(),
    next: async () => {
      const { value, done } = await r.read();
      return done ? null : dec.decode(value);
    },
  };
}

function setup(over: Partial<SseOptions> = {}) {
  const ac = new AbortController();
  let send: Send = () => undefined;
  const unsubscribe = vi.fn();
  const res = createSseResponse({
    snapshot: { a: 1 },
    subscribe: (s) => {
      send = s;
      return unsubscribe;
    },
    signal: ac.signal,
    ...over,
  });
  return { res, ac, unsubscribe, send: (...a: Parameters<Send>) => send(...a), r: reader(res) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createSseResponse", () => {
  it("sets stream headers and sends the snapshot first without an id", async () => {
    const { res, r } = setup();
    expect(res.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    expect(res.headers.get("connection")).toBe("keep-alive");
    expect(await r.next()).toBe('event: snapshot\ndata: {"a":1}\n\n');
  });

  it("frames events with id, event and single-line data", async () => {
    const { send, r } = setup();
    await r.next();
    send("call.done", { x: "a\nb" }, 3);
    expect(await r.next()).toBe('id: 3\nevent: call.done\ndata: {"x":"a\\nb"}\n\n');
  });

  it("delivers events emitted during subscribe after the snapshot, in order", async () => {
    const res = createSseResponse({
      snapshot: "s",
      signal: new AbortController().signal,
      subscribe: (send) => {
        send("e", 1, 1);
        send("e", 2, 2);
        return () => undefined;
      },
    });
    const r = reader(res);
    expect(await r.next()).toContain("event: snapshot");
    expect(await r.next()).toContain("id: 1\n");
    expect(await r.next()).toContain("id: 2\n");
  });

  it("sends replay before live events without duplicating buffered ids", async () => {
    const res = createSseResponse({
      snapshot: "s",
      signal: new AbortController().signal,
      replay: [
        { id: 1, event: "e", data: 1 },
        { id: 2, event: "e", data: 2 },
      ],
      subscribe: (send) => {
        send("e", 2, 2);
        send("e", 3, 3);
        return () => undefined;
      },
    });
    const r = reader(res);
    const frames = [await r.next(), await r.next(), await r.next(), await r.next()];
    expect(frames.map((f) => /id: (\d+)/.exec(f ?? "")?.[1] ?? "snap")).toEqual([
      "snap",
      "1",
      "2",
      "3",
    ]);
  });

  it("emits a heartbeat comment every heartbeatMs", async () => {
    const { r } = setup();
    await r.next();
    const pending = r.next();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toBe(": ping\n\n");
  });

  it("closes graceMs after session.done", async () => {
    const { send, r, unsubscribe } = setup();
    await r.next();
    send("session.done", { status: "done" }, 9);
    expect(await r.next()).toContain("event: session.done");
    const end = r.next();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await end).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("cleans up exactly once on abort and stops timers", async () => {
    const { ac, r, unsubscribe } = setup();
    await r.next();
    ac.abort();
    ac.abort();
    expect(await r.next()).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up when the consumer cancels the stream", async () => {
    const { r, unsubscribe } = setup();
    await r.cancel();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("parseLastEventId", () => {
  const req = (v?: string) => new Request("http://x", v ? { headers: { "last-event-id": v } } : {});
  it("parses non-negative integers only", () => {
    expect(parseLastEventId(req("5"))).toBe(5);
    expect(parseLastEventId(req("0"))).toBe(0);
    expect(parseLastEventId(req("-1"))).toBeUndefined();
    expect(parseLastEventId(req("1.5"))).toBeUndefined();
    expect(parseLastEventId(req("abc"))).toBeUndefined();
    expect(parseLastEventId(req())).toBeUndefined();
  });
});
