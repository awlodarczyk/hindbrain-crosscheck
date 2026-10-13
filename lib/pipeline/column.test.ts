import { log } from "@/lib/log";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixtures from "@/tests/fixtures/mock-answers.json";
import type { Db } from "@/lib/db/client";
import type { ProviderId } from "@/lib/db/enums";
import { createTestDb } from "@/lib/db/test-db";
import { getCall, listCalls } from "@/lib/repos/calls";
import { listClaims } from "@/lib/repos/claims";
import { createRun } from "@/lib/repos/runs";
import { createSession } from "@/lib/repos/sessions";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { ProviderError } from "@/lib/providers/errors";
import { createMockProvider, type MockOptions } from "@/lib/providers/mock";
import type { Provider } from "@/lib/providers/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { SettingsSchema } from "@/lib/settings/schema";
import { buildRequest, runColumn, type ColumnDeps } from "./column";
import type { RunEvent } from "./events";
import { resolveModels } from "./resolve-models";

const QUESTION = "Is static stretching before training useful?";
const models = resolveModels(DEFAULT_SETTINGS, { claude: "mock", chatgpt: "mock" });

let db: Db;
let sessionId: string;
let runId: string;
let events: RunEvent[];

function provider(id: ProviderId, opts: MockOptions = {}): Provider {
  const p = createMockProvider(id, opts);
  vi.spyOn(p, "call");
  return p;
}

function deps(providers: Partial<Record<ProviderId, Provider>> = {}): ColumnDeps {
  return {
    db,
    providers: { claude: provider("claude"), chatgpt: provider("chatgpt"), ...providers },
    settings: DEFAULT_SETTINGS,
    models,
    emit: (e) => events.push(e),
    signal: new AbortController().signal,
    sessionId,
    runId,
    question: QUESTION,
  };
}

const types = () => events.map((e) => e.type);
const plan = { answerer: "claude", reviewer: "chatgpt" } as const;

beforeEach(() => {
  db = createTestDb();
  ensureLocalUser(db);
  sessionId = createSession(db, {
    userId: LOCAL_USER_ID,
    question: QUESTION,
    mode: "ask",
    settingsSnapshot: DEFAULT_SETTINGS,
  }).id;
  runId = createRun(db, sessionId, "initial").id;
  events = [];
});

describe("buildRequest", () => {
  const settings = SettingsSchema.parse({
    tuning: { webSearchMax: 5, temperature: 0.4, preferredDomains: ["nih.gov"] },
    cost: { maxSearchesPerCall: 3, timeoutSeconds: 120 },
    reasoningEffort: "medium",
  });
  const ctx = { settings, models, question: QUESTION };

  it("builds an answer request with the answer model and limits", () => {
    const req = buildRequest("answer", ctx, "claude");
    expect(req).toMatchObject({
      kind: "answer",
      model: "claude-opus-5-5",
      maxSearches: 3,
      temperature: 0.4,
      reasoningEffort: "medium",
      timeoutMs: 120_000,
      preferredDomains: ["nih.gov"],
    });
    expect(req.user).toContain(QUESTION);
  });

  it("takes the smaller search limit from tuning", () => {
    const s = SettingsSchema.parse({
      tuning: { webSearchMax: 2 },
      cost: { maxSearchesPerCall: 9 },
    });
    expect(buildRequest("answer", { ...ctx, settings: s }, "claude").maxSearches).toBe(2);
  });

  it("builds a review request with the verification model and the answer text", () => {
    const req = buildRequest("review", ctx, "chatgpt", {
      answerText: "THE ANSWER TEXT",
      answerProvider: "claude",
    });
    expect(req.kind).toBe("review");
    expect(req.model).toBe("gpt-5.5-mini");
    expect(req.user).toContain("THE ANSWER TEXT");
    expect(req.user).toContain(QUESTION);
  });
});

describe("runColumn", () => {
  it("runs answer then review and emits events in order", async () => {
    await runColumn(deps(), plan);
    expect(types()).toEqual([
      "call.started",
      "call.progress",
      "call.progress",
      "call.progress",
      "session.stats",
      "call.done",
      "call.started",
      "call.progress",
      "call.progress",
      "call.progress",
      "session.stats",
      "call.done",
    ]);
    expect(events[0]).toMatchObject({ kind: "answer", provider: "claude" });
    expect(events[6]).toMatchObject({ kind: "review", provider: "chatgpt", model: "gpt-5.5-mini" });
    expect(events[11]).toMatchObject({ type: "call.done", claims: 4, searches: 2 });
  });

  it("persists the answer html and the review claims", async () => {
    await runColumn(deps(), plan);
    const [answer, review] = listCalls(db, runId);
    expect(answer).toMatchObject({ kind: "answer", status: "done", pasted: false, searches: 2 });
    expect(answer?.html).toContain("<p>");
    expect(answer?.html).toContain("<strong>");
    expect(answer?.durationMs).toBeGreaterThanOrEqual(0);
    expect(answer?.citations.length).toBeGreaterThan(0);
    expect(review).toMatchObject({ kind: "review", status: "done", errorCode: null });
    const claims = listClaims(db, review?.id ?? "");
    expect(claims).toHaveLength(4);
    expect(claims.map((c) => c.idx)).toEqual([0, 1, 2, 3]);
    expect(claims.filter((c) => c.verdict === "disputed")).toHaveLength(1);
  });

  it("measures durations with the injected clock", async () => {
    let t = 0;
    await runColumn({ ...deps(), now: () => new Date((t += 1000)) }, plan);
    const [answer] = listCalls(db, runId);
    expect(answer?.durationMs).toBe(
      Date.parse(answer?.finishedAt ?? "") - Date.parse(answer?.startedAt ?? ""),
    );
    expect(answer?.durationMs).toBeGreaterThan(0);
  });

  it("marks the answer failed and skips the review when the answer fails", async () => {
    const claude = provider("claude", { failWith: new ProviderError("timeout", "too slow") });
    const d = deps({ claude });
    await runColumn(d, plan);
    const [answer, review] = listCalls(db, runId);
    expect(answer).toMatchObject({
      status: "failed",
      errorCode: "timeout",
      errorMessage: "too slow",
    });
    expect(review).toMatchObject({ kind: "review", status: "skipped", errorCode: "answer_failed" });
    expect(d.providers.chatgpt.call).not.toHaveBeenCalled();
    expect(types().slice(-4)).toEqual([
      "session.stats",
      "call.failed",
      "session.stats",
      "call.skipped",
    ]);
    expect(events.find((e) => e.type === "call.failed")).toMatchObject({ code: "timeout" });
  });

  it("marks the review failed and keeps the answer when the review fails", async () => {
    const chatgpt = provider("chatgpt", {
      failWith: new ProviderError("network", "offline"),
      failFor: "review",
    });
    await runColumn(deps({ chatgpt }), plan);
    const [answer, review] = listCalls(db, runId);
    expect(answer?.status).toBe("done");
    expect(review).toMatchObject({ status: "failed", errorCode: "network" });
    expect(types().at(-1)).toBe("call.failed");
  });

  it("maps unexpected errors to internal", async () => {
    const claude = provider("claude");
    vi.mocked(claude.call).mockRejectedValueOnce(new Error("boom"));
    await runColumn(deps({ claude }), plan);
    expect(listCalls(db, runId)[0]).toMatchObject({ errorCode: "internal", errorMessage: "boom" });
  });

  it("flags unparsed reviews", async () => {
    const chatgpt = provider("chatgpt", {
      fixtures: { ...fixtures, review: { text: "Looks fine to me.", citations: [] } },
    });
    await runColumn(deps({ chatgpt }), plan);
    expect(listCalls(db, runId)[1]).toMatchObject({ status: "done", errorCode: "review_unparsed" });
  });

  it("stores a pasted answer without calling the answerer", async () => {
    const d = deps();
    await runColumn(d, { ...plan, pastedAnswer: "**Pasted** answer" });
    const [answer, review] = listCalls(db, runId);
    expect(answer).toMatchObject({
      pasted: true,
      model: "pasted",
      status: "done",
      transport: "mock",
    });
    expect(answer?.html).toContain("<strong>Pasted</strong>");
    expect(d.providers.claude.call).not.toHaveBeenCalled();
    expect(d.providers.chatgpt.call).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d.providers.chatgpt.call).mock.calls[0]?.[0].user).toContain("Pasted");
    expect(review?.status).toBe("done");
    expect(types().slice(0, 3)).toEqual(["session.stats", "call.done", "call.started"]);
  });

  it("reruns only the review and reuses its row", async () => {
    await runColumn(deps(), plan);
    const [answer, review] = listCalls(db, runId);
    events = [];
    const d = deps();
    await runColumn(d, {
      ...plan,
      only: "review",
      existing: { answerCallId: answer?.id, reviewCallId: review?.id },
    });
    expect(d.providers.claude.call).not.toHaveBeenCalled();
    expect(d.providers.chatgpt.call).toHaveBeenCalledTimes(1);
    const calls = listCalls(db, runId);
    expect(calls.map((c) => c.id)).toEqual([answer?.id, review?.id]);
    expect(listClaims(db, review?.id ?? "")).toHaveLength(4);
    expect(events[0]).toMatchObject({ type: "call.started", callId: review?.id });
  });

  it("skips a review retry when the answer has no text", async () => {
    const claude = provider("claude", { failWith: new ProviderError("timeout", "slow") });
    await runColumn(deps({ claude }), plan);
    const [answer, review] = listCalls(db, runId);
    const d = deps();
    await runColumn(d, {
      ...plan,
      only: "review",
      existing: { answerCallId: answer?.id, reviewCallId: review?.id },
    });
    expect(d.providers.chatgpt.call).not.toHaveBeenCalled();
    expect(getCall(db, review?.id ?? "")?.status).toBe("skipped");
  });
});

describe("runColumn resilience", () => {
  it("never rejects when an emitter throws and fails the rows it left open", async () => {
    const spy = vi.spyOn(log, "error").mockImplementation(() => undefined);
    const d = {
      ...deps(),
      emit: () => {
        throw new Error("subscriber gone");
      },
    };
    await expect(runColumn(d, plan)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    const [answer] = listCalls(db, runId);
    expect(answer).toMatchObject({
      status: "failed",
      errorCode: "internal",
      errorMessage: "subscriber gone",
    });
    spy.mockRestore();
  });

  it("skips the review with reason aborted when aborted after the answer", async () => {
    const ac = new AbortController();
    const d = {
      ...deps(),
      signal: ac.signal,
      emit: (e: RunEvent) => {
        events.push(e);
        if (e.type === "call.done") ac.abort();
      },
    };
    await runColumn(d, plan);
    const [answer, review] = listCalls(db, runId);
    expect(answer?.status).toBe("done");
    expect(review).toMatchObject({ status: "skipped", errorCode: "aborted" });
    expect(d.providers.chatgpt.call).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: "call.skipped", reason: "aborted" });
  });
});
