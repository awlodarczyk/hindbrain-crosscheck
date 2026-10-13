import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { listCallsForSession } from "@/lib/repos/calls";
import { listClaims } from "@/lib/repos/claims";
import { createSession, getSession, recomputeStats } from "@/lib/repos/sessions";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { createMockProvider } from "@/lib/providers/mock";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { RunEvent } from "@/lib/pipeline/events";
import { runSession } from "@/lib/pipeline/run-session";

describe("pipeline with mock providers", () => {
  it("persists rows that match the emitted events", async () => {
    const db = createTestDb();
    ensureLocalUser(db);
    const sid = createSession(db, {
      userId: LOCAL_USER_ID,
      question: "Does stretching prevent injury?",
      mode: "ask",
      settingsSnapshot: DEFAULT_SETTINGS,
    }).id;
    const events: RunEvent[] = [];
    const providers = {
      claude: createMockProvider("claude"),
      chatgpt: createMockProvider("chatgpt"),
    };

    const res = await runSession(
      { db, providers, settings: DEFAULT_SETTINGS, emit: (e) => events.push(e) },
      sid,
      { reason: "initial" },
    );

    const calls = listCallsForSession(db, sid);
    const started = events.flatMap((e) => (e.type === "call.started" ? [e] : []));
    const done = events.flatMap((e) => (e.type === "call.done" ? [e] : []));
    expect(calls.map((c) => c.id).sort()).toEqual(started.map((e) => e.callId).sort());
    expect(done).toHaveLength(calls.length);
    calls.forEach((c) => {
      expect(c.status).toBe("done");
      const ev = started.find((e) => e.callId === c.id);
      expect(ev).toMatchObject({ kind: c.kind, provider: c.provider, model: c.model });
    });

    const reviews = calls.filter((c) => c.kind === "review");
    expect(reviews).toHaveLength(2);
    reviews.forEach((r) => {
      const claims = listClaims(db, r.id);
      expect(done.find((e) => e.callId === r.id)?.claims).toBe(claims.length);
      expect(claims.map((c) => c.verdict)).toEqual([
        "supported",
        "disputed",
        "supported",
        "supported",
      ]);
    });

    const lastStats = events.filter((e) => e.type === "session.stats").at(-1);
    const stored = getSession(db, LOCAL_USER_ID, sid);
    expect(lastStats).toMatchObject({ stats: stored?.stats, status: "done" });
    expect(recomputeStats(db, sid)).toEqual(stored?.stats);
    expect(events.at(-1)).toEqual({
      type: "session.done",
      sessionId: sid,
      status: res.status,
      disputed: stored?.stats.disputed,
    });
  });
});
