import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { sweepInterrupted } from "@/lib/jobs/boot";
import { createCall, listCallsForSession } from "@/lib/repos/calls";
import { createRun, latestRun, setRunStatus } from "@/lib/repos/runs";
import { createSession, setSessionStatus, getSession } from "@/lib/repos/sessions";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";

describe("sweepInterrupted", () => {
  it("fails in-flight calls, derives run and session status, and is idempotent", () => {
    const db = createTestDb();
    ensureLocalUser(db);
    const s = createSession(db, {
      userId: LOCAL_USER_ID,
      question: "q",
      mode: "ask",
      settingsSnapshot: DEFAULT_SETTINGS,
    });
    const run = createRun(db, s.id, "initial");
    setRunStatus(db, run.id, "running");
    setSessionStatus(db, s.id, "running");
    const base = { runId: run.id, transport: "mock", model: "m" } as const;
    createCall(db, { ...base, kind: "answer", provider: "claude", status: "running" });
    createCall(db, { ...base, kind: "answer", provider: "chatgpt", status: "queued" });

    const now = new Date("2026-01-01T00:00:00Z");
    expect(sweepInterrupted(db, now)).toEqual({ calls: 2, sessions: 1 });
    for (const c of listCallsForSession(db, s.id)) {
      expect(c).toMatchObject({
        status: "failed",
        errorCode: "interrupted",
        errorMessage: "The app restarted while this call was running. Retry.",
        finishedAt: now.toISOString(),
      });
    }
    expect(latestRun(db, s.id)?.status).toBe("failed");
    expect(getSession(db, LOCAL_USER_ID, s.id)?.status).toBe("failed");
    expect(sweepInterrupted(db, now)).toEqual({ calls: 0, sessions: 0 });
  });
});
