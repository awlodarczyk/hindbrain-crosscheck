import { describe, expect, it } from "vitest";
import type { RunEvent } from "@/lib/pipeline/events";
import { applyEvent, statusLabel } from "./apply-event";
import { makeCall, makeDetail, makeRun, makeSession } from "./fixtures";
import type { SessionDetail } from "@/lib/api/sessions-dto";

const base = (): SessionDetail => ({
  session: makeSession({ status: "queued" }),
  runs: [makeRun({ id: "r1", status: "queued" })],
  calls: [makeCall({ id: "c1", runId: "r1", status: "running", searches: 0, html: null })],
  claims: [],
});

function check(prev: SessionDetail, e: RunEvent): SessionDetail {
  const snapshot = structuredClone(prev);
  const next = applyEvent(prev, e);
  expect(next).not.toBe(prev);
  expect(prev).toEqual(snapshot);
  return next;
}

describe("applyEvent", () => {
  it("run.started adds a run and marks the session running", () => {
    const prev = { ...base(), runs: [] };
    const next = check(prev, { type: "run.started", sessionId: "s1", runId: "r9", attempt: 1 });
    expect(next.runs[0]).toMatchObject({
      id: "r9",
      attempt: 1,
      reason: "initial",
      status: "running",
    });
    expect(next.session.status).toBe("running");
  });

  it("run.started with attempt > 1 is a manual run", () => {
    const next = check(base(), { type: "run.started", sessionId: "s1", runId: "r2", attempt: 2 });
    expect(next.runs.find((r) => r.id === "r2")?.reason).toBe("manual");
  });

  it("run.started is idempotent for a known run id", () => {
    const e: RunEvent = { type: "run.started", sessionId: "s1", runId: "r1", attempt: 1 };
    const once = check(base(), e);
    const twice = check(once, e);
    expect(twice.runs).toHaveLength(1);
    expect(twice.runs[0]?.status).toBe("running");
  });

  it("call.started inserts a running call on the latest run", () => {
    const next = check(base(), {
      type: "call.started",
      sessionId: "s1",
      callId: "c2",
      kind: "answer",
      provider: "chatgpt",
      model: "gpt-x",
    });
    expect(next.calls.find((c) => c.id === "c2")).toMatchObject({
      runId: "r1",
      provider: "chatgpt",
      model: "gpt-x",
      status: "running",
      searches: 0,
    });
  });

  it("call.started upserts an existing call and tolerates no runs", () => {
    const e: RunEvent = {
      type: "call.started",
      sessionId: "s1",
      callId: "c1",
      kind: "answer",
      provider: "claude",
      model: "m",
    };
    const next = check(base(), e);
    expect(next.calls).toHaveLength(1);
    const orphan = check({ ...base(), runs: [], calls: [] }, e);
    expect(orphan.calls).toHaveLength(1);
  });

  it("call.progress sets searches", () => {
    const next = check(base(), {
      type: "call.progress",
      sessionId: "s1",
      callId: "c1",
      phase: "searching",
      searches: 2,
    });
    expect(next.calls[0]?.searches).toBe(2);
  });

  it("call.done marks done with duration and searches", () => {
    const next = check(base(), {
      type: "call.done",
      sessionId: "s1",
      callId: "c1",
      durationMs: 1200,
      searches: 3,
    });
    expect(next.calls[0]).toMatchObject({ status: "done", durationMs: 1200, searches: 3 });
  });

  it("call.failed records the error", () => {
    const next = check(base(), {
      type: "call.failed",
      sessionId: "s1",
      callId: "c1",
      code: "provider_http",
      message: "boom",
    });
    expect(next.calls[0]).toMatchObject({
      status: "failed",
      errorCode: "provider_http",
      errorMessage: "boom",
    });
    expect(next.calls[0]?.finishedAt).not.toBeNull();
  });

  it("call.skipped records the reason", () => {
    const next = check(base(), {
      type: "call.skipped",
      sessionId: "s1",
      callId: "c1",
      reason: "answer_failed",
    });
    expect(next.calls[0]).toMatchObject({ status: "skipped", errorCode: "answer_failed" });
  });

  it("session.stats updates stats and status", () => {
    const stats = { ...makeSession().stats, calls: 4, callsDone: 1 };
    const next = check(base(), {
      type: "session.stats",
      sessionId: "s1",
      stats,
      status: "running",
    });
    expect(next.session.stats).toEqual(stats);
    expect(next.session.status).toBe("running");
  });

  it("session.done sets the final status", () => {
    const next = check(makeDetail(), {
      type: "session.done",
      sessionId: "s1",
      status: "partial",
      disputed: 0,
    });
    expect(next.session.status).toBe("partial");
    expect(next.runs.at(-1)?.status).toBe("partial");
    expect(next.runs.at(-1)?.finishedAt).not.toBeNull();
  });

  it("ignores events for unknown call ids without changing identity", () => {
    const prev = base();
    const e: RunEvent = {
      type: "call.progress",
      sessionId: "s1",
      callId: "nope",
      phase: "writing",
      searches: 1,
    };
    expect(applyEvent(prev, e)).toBe(prev);
  });

  it("returns the same reference for unknown event types", () => {
    const prev = base();
    const odd = { type: "mystery", sessionId: "s1" } as unknown as RunEvent;
    expect(applyEvent(prev, odd)).toBe(prev);
  });
});

describe("statusLabel", () => {
  it.each([
    ["answer", "claude", "running", "Claude is answering…"],
    ["review", "chatgpt", "running", "ChatGPT is checking sources…"],
    ["review", "chatgpt", "queued", "Starts when Claude's answer lands"],
    ["review", "claude", "queued", "Starts when ChatGPT's answer lands"],
    ["answer", "claude", "queued", "Waiting to start"],
  ] as const)("%s/%s/%s", (kind, provider, status, text) => {
    expect(statusLabel(makeCall({ kind, provider, status }), provider, kind)).toBe(text);
  });
  it("handles a missing call", () => {
    expect(statusLabel(null, "chatgpt", "review")).toBe("Starts when Claude's answer lands");
  });
});
