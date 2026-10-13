import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/client";
import type { ProviderId } from "@/lib/db/enums";
import { createTestDb } from "@/lib/db/test-db";
import { listCallsForSession } from "@/lib/repos/calls";
import { listRuns } from "@/lib/repos/runs";
import { createSession, getSession } from "@/lib/repos/sessions";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { createMockProvider, type MockFixtures } from "@/lib/providers/mock";
import type { Provider } from "@/lib/providers/types";
import type { RunEvent } from "@/lib/pipeline/events";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { Settings } from "@/lib/settings/schema";
import { createBus, type Bus } from "./bus";
import { createRunner, type Runner } from "./runner";

let db: Db;
let bus: Bus;
let events: RunEvent[];

const claim = (n: number) =>
  `{ "claim": "Claim number ${n}", "verdict": "disputed", "note": "n", "source": { "title": "t", "url": "https://e.com/${n}" } }`;
const DISPUTED: MockFixtures = {
  answers: {
    claude: { text: "Answer one.", citations: [] },
    chatgpt: { text: "Answer two.", citations: [] },
  },
  review: {
    text: `Review\n\n\`\`\`json\n{ "overall": "x", "claims": [${[1, 2, 3].map(claim).join(",")}] }\n\`\`\``,
    citations: [],
  },
};

const providers =
  (delayMs = 0, fixtures?: MockFixtures) =>
  async () =>
    Object.fromEntries(
      (["claude", "chatgpt"] as const).map((id) => [
        id,
        createMockProvider(id, { delayMs, fixtures }),
      ]),
    ) as Record<ProviderId, Provider>;

const settings = (rerun: boolean): Settings => ({
  ...DEFAULT_SETTINGS,
  verification: { ...DEFAULT_SETTINGS.verification, rerunOnDisagreement: rerun },
});

const seed = () =>
  createSession(db, {
    userId: LOCAL_USER_ID,
    question: "Is static stretching useful?",
    mode: "ask",
    settingsSnapshot: DEFAULT_SETTINGS,
  }).id;

function make(over: Partial<Parameters<typeof createRunner>[0]> = {}): Runner {
  return createRunner({
    db,
    bus,
    providersFor: providers(),
    settingsFor: () => settings(false),
    ...over,
  });
}

beforeEach(() => {
  db = createTestDb();
  ensureLocalUser(db);
  bus = createBus();
  events = [];
});

const job = (sessionId: string) => ({
  sessionId,
  userId: LOCAL_USER_ID,
  reason: "initial" as const,
});

describe("runner", () => {
  it("queues beyond concurrency and rejects duplicate sessions", async () => {
    const runner = make({ concurrency: 1, providersFor: providers(40) });
    const [a, b] = [seed(), seed()];
    expect(runner.enqueue(job(a))).toEqual({ queued: true });
    expect(runner.enqueue(job(b))).toEqual({ queued: true });
    expect(runner.enqueue(job(a))).toEqual({ queued: false, reason: "already_active" });
    await vi.waitFor(() => expect(runner.active()).toEqual([a]));
    expect(runner.pending()).toEqual([b]);
    await runner.drain();
    expect(runner.active()).toEqual([]);
    expect(runner.pending()).toEqual([]);
    expect(listRuns(db, b)).toHaveLength(1);
  });

  it("cancel aborts the active session", async () => {
    const runner = make({ providersFor: providers(200) });
    const sid = seed();
    bus.subscribe(sid, (e) => events.push(e));
    runner.enqueue(job(sid));
    await vi.waitFor(() => expect(runner.active()).toEqual([sid]));
    await vi.waitFor(() => expect(listCallsForSession(db, sid).length).toBeGreaterThan(0));
    expect(runner.cancel(sid)).toBe(true);
    expect(runner.cancel("nope")).toBe(false);
    await runner.drain();
    const calls = listCallsForSession(db, sid);
    expect(calls.some((c) => c.errorCode === "aborted")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "session.done", status: "failed" });
  });

  it("cancel removes a queued job", async () => {
    const runner = make({ concurrency: 1, providersFor: providers(20) });
    const [a, b] = [seed(), seed()];
    runner.enqueue(job(a));
    runner.enqueue(job(b));
    bus.subscribe(b, (e) => events.push(e));
    expect(runner.cancel(b)).toBe(true);
    expect(runner.pending()).toEqual([]);
    expect(events).toEqual([expect.objectContaining({ type: "session.done", status: "failed" })]);
    expect(getSession(db, LOCAL_USER_ID, b)?.status).toBe("failed");
    await runner.drain();
    expect(listRuns(db, b)).toHaveLength(0);
  });

  it("re-runs once on disagreement", async () => {
    const runner = make({
      providersFor: providers(0, DISPUTED),
      settingsFor: () => settings(true),
    });
    const sid = seed();
    runner.enqueue(job(sid));
    await runner.drain();
    expect(listRuns(db, sid).map((r) => r.reason)).toEqual(["initial", "disagreement"]);
  });

  it("sets failed status even when onError throws", async () => {
    const runner = make({
      onError: () => {
        throw new Error("bad hook");
      },
    });
    const sid = seed();
    bus.subscribe("missing", (e) => events.push(e));
    runner.enqueue(job("missing"));
    runner.enqueue(job(sid));
    await runner.drain();
    expect(events.at(-1)).toMatchObject({ type: "session.done", status: "failed" });
  });

  it("survives runSession throwing and continues", async () => {
    const onError = vi.fn();
    const runner = make({ concurrency: 1, onError });
    const good = seed();
    bus.subscribe("missing", (e) => events.push(e));
    runner.enqueue(job("missing"));
    runner.enqueue(job(good));
    await runner.drain();
    expect(onError).toHaveBeenCalledOnce();
    expect(events.at(-1)).toMatchObject({ type: "session.done", status: "failed" });
    expect(listRuns(db, good)).toHaveLength(1);
  });
});
