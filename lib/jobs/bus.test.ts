import { describe, expect, it, vi } from "vitest";
import type { RunEvent } from "@/lib/pipeline/events";
import { createBus, type BusEvent } from "./bus";

const progress = (sessionId = "s1"): RunEvent => ({
  type: "call.progress",
  sessionId,
  callId: "c",
  phase: "searching",
  searches: 1,
});
const started = (sessionId = "s1"): RunEvent => ({
  type: "run.started",
  sessionId,
  runId: "r",
  attempt: 1,
});
const done = (sessionId = "s1"): RunEvent => ({
  type: "session.done",
  sessionId,
  status: "done",
  disputed: 0,
});

describe("bus", () => {
  it("delivers events with increasing ids and stops after unsubscribe", () => {
    const bus = createBus();
    const got: BusEvent[] = [];
    const off = bus.subscribe("s1", (e) => got.push(e));
    bus.emit(progress());
    bus.emit(progress());
    off();
    bus.emit(progress());
    expect(got.map((e) => e.id)).toEqual([1, 2]);
  });

  it("replays events after a given id", () => {
    const bus = createBus();
    [progress(), progress(), progress()].forEach((e) => bus.emit(e));
    expect(bus.replay("s1", 1).map((e) => e.id)).toEqual([2, 3]);
    expect(bus.replay("s1")).toHaveLength(3);
    expect(bus.replay("other")).toEqual([]);
  });

  it("bounds the ring", () => {
    const bus = createBus({ ringSize: 2 });
    [progress(), progress(), progress()].forEach((e) => bus.emit(e));
    expect(bus.replay("s1").map((e) => e.id)).toEqual([2, 3]);
  });

  it("isolates throwing subscribers", () => {
    const bus = createBus();
    const ok = vi.fn();
    bus.subscribe("s1", () => {
      throw new Error("boom");
    });
    bus.subscribe("s1", ok);
    expect(() => bus.emit(progress())).not.toThrow();
    expect(ok).toHaveBeenCalledOnce();
  });

  it("tracks activity between run.started and session.done", () => {
    const bus = createBus();
    expect(bus.isActive("s1")).toBe(false);
    bus.emit(started());
    expect(bus.isActive("s1")).toBe(true);
    bus.emit(done());
    expect(bus.isActive("s1")).toBe(false);
  });

  it("forgets after retention unless subscribers exist", () => {
    vi.useFakeTimers();
    try {
      const bus = createBus({ retentionMs: 1000 });
      bus.emit(done("a"));
      const off = bus.subscribe("b", () => {});
      bus.emit(done("b"));
      vi.advanceTimersByTime(1001);
      expect(bus.replay("a")).toEqual([]);
      expect(bus.replay("b")).toHaveLength(1);
      off();
      bus.forget("b");
      expect(bus.replay("b")).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
