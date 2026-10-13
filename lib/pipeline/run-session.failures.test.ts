import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { listCalls } from "@/lib/repos/calls";
import { listClaims } from "@/lib/repos/claims";
import { latestRun } from "@/lib/repos/runs";
import { createSession, getSession } from "@/lib/repos/sessions";
import type { Call } from "@/lib/repos/types";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { createMockProvider } from "@/lib/providers/mock";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { RunEvent } from "./events";
import { runSession, type RunDeps } from "./run-session";

type Patch = Partial<Call>;
const hooks = vi.hoisted(() => ({
  failUpdate: null as null | ((patch: Partial<Record<string, unknown>>) => boolean),
  failFinishRun: false,
  failSetRunStatus: false,
}));

vi.mock("@/lib/repos/calls", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/lib/repos/calls")>();
  return {
    ...m,
    updateCall: (db: Db, id: string, patch: Patch) => {
      if (hooks.failUpdate?.(patch)) throw new Error("disk full");
      return m.updateCall(db, id, patch);
    },
  };
});

vi.mock("@/lib/repos/runs", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/lib/repos/runs")>();
  return {
    ...m,
    finishRun: (...args: Parameters<typeof m.finishRun>) => {
      if (hooks.failFinishRun) throw new Error("finish failed");
      return m.finishRun(...args);
    },
    setRunStatus: (...args: Parameters<typeof m.setRunStatus>) => {
      if (hooks.failSetRunStatus) throw new Error("status failed");
      return m.setRunStatus(...args);
    },
  };
});

let db: Db;
let sid: string;
let events: RunEvent[];

const deps = (): RunDeps => ({
  db,
  providers: { claude: createMockProvider("claude"), chatgpt: createMockProvider("chatgpt") },
  settings: DEFAULT_SETTINGS,
  emit: (e) => events.push(e),
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  db = createTestDb();
  ensureLocalUser(db);
  sid = createSession(db, {
    userId: LOCAL_USER_ID,
    question: "q",
    mode: "ask",
    settingsSnapshot: DEFAULT_SETTINGS,
  }).id;
  events = [];
});

afterEach(() => {
  hooks.failUpdate = null;
  hooks.failFinishRun = false;
  hooks.failSetRunStatus = false;
  vi.restoreAllMocks();
});

describe("runSession failure isolation", () => {
  it("marks a call failed/internal when persisting its result throws", async () => {
    hooks.failUpdate = (p) => p.status === "done";
    const res = await runSession(deps(), sid, { reason: "initial" });
    const answers = listCalls(db, res.runId).filter((c) => c.kind === "answer");
    answers.forEach((c) =>
      expect(c).toMatchObject({
        status: "failed",
        errorCode: "internal",
        errorMessage: "disk full",
      }),
    );
    expect(res.status).toBe("failed");
    expect(events.at(-1)).toMatchObject({ type: "session.done", status: "failed" });
  });

  it("keeps running when a progress update throws", async () => {
    hooks.failUpdate = (p) => p.status === undefined && "searches" in p;
    const res = await runSession(deps(), sid, { reason: "initial" });
    expect(res.status).toBe("done");
  });

  it("keeps old claims when resetting a reused row fails", async () => {
    const first = await runSession(deps(), sid, { reason: "initial" });
    const review = listCalls(db, first.runId).find((c) => c.kind === "review");
    hooks.failUpdate = (p) => p.status === "running";
    await runSession(deps(), sid, { reason: "manual", retryCallId: review?.id });
    expect(listClaims(db, review?.id ?? "")).toHaveLength(4);
    expect(events.at(-1)?.type).toBe("session.done");
  });

  it("falls back to failed statuses when finalizing throws", async () => {
    hooks.failFinishRun = true;
    const res = await runSession(deps(), sid, { reason: "initial" });
    expect(res.status).toBe("failed");
    expect(latestRun(db, sid)?.status).toBe("failed");
    expect(getSession(db, LOCAL_USER_ID, sid)?.status).toBe("failed");
    expect(events.at(-1)).toMatchObject({ type: "session.done", status: "failed" });
  });

  it("emits session.done and rethrows when starting the run fails", async () => {
    hooks.failSetRunStatus = true;
    await expect(runSession(deps(), sid, { reason: "initial" })).rejects.toThrow("status failed");
    expect(events.at(-1)).toMatchObject({ type: "session.done", status: "failed" });
    expect(getSession(db, LOCAL_USER_ID, sid)?.status).toBe("failed");
  });
});
