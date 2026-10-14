import { log } from "@/lib/log";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/client";
import type { ProviderId, SessionMode } from "@/lib/db/enums";
import { createTestDb } from "@/lib/db/test-db";
import { listCalls } from "@/lib/repos/calls";
import { createSession, getSession } from "@/lib/repos/sessions";
import { latestRun } from "@/lib/repos/runs";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { ProviderError } from "@/lib/providers/errors";
import { createMockProvider, type MockOptions } from "@/lib/providers/mock";
import type { Provider } from "@/lib/providers/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { RunEvent } from "./events";
import { runSession, type RunDeps } from "./run-session";

let db: Db;
let events: RunEvent[];

function provider(id: ProviderId, opts: MockOptions = {}): Provider {
  const p = createMockProvider(id, opts);
  vi.spyOn(p, "call");
  return p;
}

function deps(
  providers: Partial<Record<ProviderId, Provider>> = {},
  signal?: AbortSignal,
): RunDeps {
  return {
    db,
    providers: { claude: provider("claude"), chatgpt: provider("chatgpt"), ...providers },
    settings: DEFAULT_SETTINGS,
    emit: (e) => events.push(e),
    signal,
  };
}

const callCount = (d: RunDeps) =>
  vi.mocked(d.providers.claude.call).mock.calls.length +
  vi.mocked(d.providers.chatgpt.call).mock.calls.length;

function session(mode: SessionMode = "ask"): string {
  return createSession(db, {
    userId: LOCAL_USER_ID,
    question: "Is static stretching useful?",
    mode,
    settingsSnapshot: DEFAULT_SETTINGS,
  }).id;
}

beforeEach(() => {
  db = createTestDb();
  ensureLocalUser(db);
  events = [];
});

describe("runSession", () => {
  it("cross-checks both answers on the happy path", async () => {
    const sid = session();
    const res = await runSession(deps(), sid, { reason: "initial" });
    expect(res).toMatchObject({ status: "done", disputed: 2 });
    expect(listCalls(db, res.runId)).toHaveLength(4);
    const s = getSession(db, LOCAL_USER_ID, sid);
    expect(s?.status).toBe("done");
    expect(s?.stats).toMatchObject({ claims: 8, disputed: 2, calls: 4, callsDone: 4 });
    expect(events.filter((e) => e.type === "run.started")).toHaveLength(1);
    expect(events.filter((e) => e.type === "session.done")).toHaveLength(1);
    expect(events.at(-1)).toEqual({
      type: "session.done",
      sessionId: sid,
      status: "done",
      disputed: 2,
    });
    expect(latestRun(db, sid)).toMatchObject({ status: "done", attempt: 1 });
    expect(latestRun(db, sid)?.finishedAt).not.toBeNull();
  });

  it("passes the transcript into every provider request", async () => {
    const sid = createSession(db, {
      userId: LOCAL_USER_ID,
      question: "focus",
      mode: "transcript",
      transcript: "User: hi\nAssistant: TRANSCRIPT-MARK",
      settingsSnapshot: DEFAULT_SETTINGS,
    }).id;
    const d = deps();
    await runSession(d, sid, { reason: "initial" });
    const reqs = [d.providers.claude.call, d.providers.chatgpt.call].flatMap((f) =>
      vi.mocked(f).mock.calls.map(([req]) => req),
    );
    expect(reqs).toHaveLength(4);
    for (const r of reqs) expect(r.user).toContain("TRANSCRIPT-MARK");
  });

  it("emits session.stats right before every call outcome", async () => {
    await runSession(deps(), session(), { reason: "initial" });
    const outcomes = ["call.done", "call.failed", "call.skipped"];
    events.forEach((e, i) => {
      if (outcomes.includes(e.type)) expect(events[i - 1]?.type).toBe("session.stats");
    });
    expect(events.filter((e) => e.type === "session.stats")).toHaveLength(4);
  });

  it("reports partial when one provider times out on its answer", async () => {
    const claude = provider("claude", {
      failWith: new ProviderError("timeout", "timed out"),
      failFor: "answer",
    });
    const res = await runSession(deps({ claude }), session(), { reason: "initial" });
    expect(res.status).toBe("partial");
    const calls = listCalls(db, res.runId);
    const byKey = (kind: string, p: string) =>
      calls.find((c) => c.kind === kind && c.provider === p)?.status;
    expect(byKey("answer", "claude")).toBe("failed");
    expect(byKey("review", "chatgpt")).toBe("skipped");
    expect(byKey("answer", "chatgpt")).toBe("done");
    expect(byKey("review", "claude")).toBe("done");
    expect(res.disputed).toBe(1);
  });

  it("paste mode with one answer runs only that column", async () => {
    const d = deps();
    const res = await runSession(d, session("paste"), {
      reason: "initial",
      pasted: { claude: "Pasted answer." },
    });
    expect(res.status).toBe("done");
    expect(listCalls(db, res.runId)).toHaveLength(2);
    expect(d.providers.claude.call).not.toHaveBeenCalled();
    expect(callCount(d)).toBe(1);
  });

  it("paste mode with both answers only calls the reviewers", async () => {
    const d = deps();
    const res = await runSession(d, session("paste"), {
      reason: "initial",
      pasted: { claude: "A.", chatgpt: "B." },
    });
    expect(listCalls(db, res.runId)).toHaveLength(4);
    expect(callCount(d)).toBe(2);
    expect(res.status).toBe("done");
  });

  it("retries a failed answer and its review in the same run", async () => {
    const sid = session();
    const claude = provider("claude", {
      failWith: new ProviderError("timeout", "slow"),
      failFor: "answer",
    });
    const first = await runSession(deps({ claude }), sid, { reason: "initial" });
    const before = listCalls(db, first.runId);
    const failed = before.find((c) => c.status === "failed");
    const skipped = before.find((c) => c.status === "skipped");
    events = [];
    const d = deps();
    const res = await runSession(d, sid, { reason: "manual", retryCallId: failed?.id });
    expect(res.runId).toBe(first.runId);
    expect(callCount(d)).toBe(2);
    const after = listCalls(db, res.runId);
    expect(after.map((c) => c.id)).toEqual(before.map((c) => c.id));
    expect(after.find((c) => c.id === skipped?.id)?.status).toBe("done");
    expect(res).toMatchObject({ status: "done", disputed: 2 });
    expect(events.at(-1)?.type).toBe("session.done");
  });

  it("retries a review only", async () => {
    const sid = session();
    const first = await runSession(deps(), sid, { reason: "initial" });
    const review = listCalls(db, first.runId).find((c) => c.kind === "review");
    const d = deps();
    const res = await runSession(d, sid, { reason: "manual", retryCallId: review?.id });
    expect(callCount(d)).toBe(1);
    expect(vi.mocked(d.providers[review?.provider ?? "claude"].call)).toHaveBeenCalledTimes(1);
    expect(res.status).toBe("done");
    expect(listCalls(db, res.runId)).toHaveLength(4);
  });

  it("rejects retries of calls outside the latest run", async () => {
    const sid = session();
    const first = await runSession(deps(), sid, { reason: "initial" });
    await runSession(deps(), sid, { reason: "manual" });
    const old = listCalls(db, first.runId)[0];
    await expect(
      runSession(deps(), sid, { reason: "manual", retryCallId: old?.id }),
    ).rejects.toThrow();
    await expect(
      runSession(deps(), sid, { reason: "manual", retryCallId: "nope" }),
    ).rejects.toThrow();
  });

  it("throws for a missing session", async () => {
    await expect(runSession(deps(), "missing", { reason: "initial" })).rejects.toThrow();
  });

  it("marks calls aborted and still finishes the session on abort", async () => {
    const ac = new AbortController();
    const d = {
      ...deps({
        claude: provider("claude", { delayMs: 50 }),
        chatgpt: provider("chatgpt", { delayMs: 50 }),
      }),
      signal: ac.signal,
      emit: (e: RunEvent) => {
        events.push(e);
        if (e.type === "call.progress") ac.abort();
      },
    };
    const res = await runSession(d, session(), { reason: "initial" });
    expect(res.status).toBe("failed");
    const failed = events.filter((e) => e.type === "call.failed");
    expect(failed).toHaveLength(2);
    failed.forEach((e) => expect(e).toMatchObject({ code: "aborted" }));
    const calls = listCalls(db, res.runId);
    expect(calls.filter((c) => c.errorCode === "aborted")).toHaveLength(4);
    expect(calls.filter((c) => c.status === "skipped")).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ type: "session.done", status: "failed" });
  });

  it("refuses to retry a pasted answer", async () => {
    const sid = session("paste");
    const first = await runSession(deps(), sid, { reason: "initial", pasted: { claude: "A." } });
    const pasted = listCalls(db, first.runId).find((c) => c.pasted);
    const d = deps();
    await expect(runSession(d, sid, { reason: "manual", retryCallId: pasted?.id })).rejects.toThrow(
      "pasted answers are not retryable",
    );
    expect(callCount(d)).toBe(0);
    expect(listCalls(db, first.runId).find((c) => c.pasted)?.text).toBe("A.");
  });

  it("retries the review of a pasted answer", async () => {
    const sid = session("paste");
    const first = await runSession(deps(), sid, { reason: "initial", pasted: { claude: "A." } });
    const review = listCalls(db, first.runId).find((c) => c.kind === "review");
    const d = deps();
    const res = await runSession(d, sid, { reason: "manual", retryCallId: review?.id });
    expect(callCount(d)).toBe(1);
    expect(res.status).toBe("done");
  });

  it("completes the run when the emitter throws", async () => {
    const spy = vi.spyOn(log, "error").mockImplementation(() => undefined);
    const d = {
      ...deps(),
      emit: () => {
        throw new Error("subscriber gone");
      },
    };
    const res = await runSession(d, session(), { reason: "initial" });
    expect(res.status).toBe("done");
    expect(listCalls(db, res.runId).every((c) => c.status === "done")).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
