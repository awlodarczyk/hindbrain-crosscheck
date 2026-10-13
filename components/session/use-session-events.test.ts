import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionDetail } from "@/lib/api/sessions-dto";
import { makeCall, makeRun, makeSession } from "./fixtures";
import { useSessionEvents } from "./use-session-events";

class FakeES {
  static all: FakeES[] = [];
  listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  closed = false;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  constructor(public url: string) {
    FakeES.all.push(this);
  }
  addEventListener(t: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn]);
  }
  close() {
    this.closed = true;
  }
  emit(t: string, data: unknown) {
    for (const fn of this.listeners.get(t) ?? [])
      fn({ data: JSON.stringify(data) } as MessageEvent);
  }
}

const running = (): SessionDetail => ({
  session: makeSession({ status: "running" }),
  runs: [makeRun({ id: "r1", status: "running" })],
  calls: [makeCall({ id: "c1", runId: "r1", status: "running" })],
  claims: [],
});
const done = (id: string) => ({
  type: "call.done",
  sessionId: "s1",
  callId: id,
  durationMs: 5,
  searches: 1,
});
const Impl = FakeES as unknown as typeof EventSource;

beforeEach(() => {
  vi.useFakeTimers();
  FakeES.all = [];
});
afterEach(() => vi.useRealTimers());

function setup(initial = running()) {
  const refetch = vi.fn(async () => ({
    ...initial,
    session: { ...initial.session, title: "fresh" },
  }));
  const hook = renderHook(() =>
    useSessionEvents("s1", initial, { refetch, EventSourceImpl: Impl }),
  );
  return { refetch, hook, es: () => FakeES.all.at(-1)! };
}

describe("useSessionEvents", () => {
  it("does not open for a settled session", () => {
    renderHook(() =>
      useSessionEvents(
        "s1",
        { ...running(), session: makeSession({ status: "done" }) },
        { EventSourceImpl: Impl },
      ),
    );
    expect(FakeES.all).toHaveLength(0);
  });

  it("opens the events url and replaces state on snapshot", () => {
    const { hook, es } = setup();
    expect(es().url).toBe("/api/sessions/s1/events");
    act(() =>
      es().emit("snapshot", {
        ...running(),
        session: makeSession({ status: "running", title: "snap" }),
      }),
    );
    expect(hook.result.current.detail.session.title).toBe("snap");
    expect(hook.result.current.connection).toBe("open");
  });

  it("reduces events and forwards them", () => {
    const onEvent = vi.fn();
    const initial = running();
    const hook = renderHook(() =>
      useSessionEvents("s1", initial, { onEvent, EventSourceImpl: Impl }),
    );
    const e = {
      type: "call.progress",
      sessionId: "s1",
      callId: "c1",
      phase: "searching",
      searches: 2,
    };
    act(() => FakeES.all[0]!.emit("call.progress", e));
    expect(hook.result.current.detail.calls[0]?.searches).toBe(2);
    expect(onEvent).toHaveBeenCalledWith(e);
  });

  it("debounces a single refetch across quick call.done events", async () => {
    const { refetch, hook, es } = setup();
    act(() => {
      es().emit("call.done", done("c1"));
      es().emit("call.done", done("c1"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(hook.result.current.detail.session.title).toBe("fresh");
  });

  it("closes on session.done and refetches", async () => {
    const { refetch, hook, es } = setup();
    act(() =>
      es().emit("session.done", {
        type: "session.done",
        sessionId: "s1",
        status: "done",
        disputed: 0,
      }),
    );
    expect(es().closed).toBe(true);
    expect(hook.result.current.connection).toBe("closed");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("reconnects with backoff after an error and gives up after 3", () => {
    const { hook, es } = setup();
    for (let i = 0; i < 3; i++) {
      const before = FakeES.all.length;
      act(() => es().onerror?.());
      expect(es().closed).toBe(true);
      if (i < 2) {
        act(() => vi.advanceTimersByTime(8000));
        expect(FakeES.all.length).toBe(before + 1);
      }
    }
    expect(hook.result.current.connection).toBe("error");
    act(() => vi.advanceTimersByTime(20000));
    expect(FakeES.all).toHaveLength(3);
  });

  it("closes on unmount", () => {
    const { hook, es } = setup();
    const source = es();
    hook.unmount();
    expect(source.closed).toBe(true);
  });

  it("reconnect() reopens a closed stream", () => {
    const { hook, es } = setup();
    act(() =>
      es().emit("session.done", {
        type: "session.done",
        sessionId: "s1",
        status: "done",
        disputed: 0,
      }),
    );
    const n = FakeES.all.length;
    act(() => hook.result.current.reconnect());
    expect(FakeES.all.length).toBe(n + 1);
    expect(es().closed).toBe(false);
  });
});
