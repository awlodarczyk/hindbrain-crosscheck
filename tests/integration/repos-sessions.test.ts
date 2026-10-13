import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { users } from "@/lib/db/schema";
import { createCall, updateCall } from "@/lib/repos/calls";
import { replaceClaims } from "@/lib/repos/claims";
import { EMPTY_STATS } from "@/lib/repos/types";
import { createRun } from "@/lib/repos/runs";
import {
  createSession,
  getSession,
  listDeletedSessions,
  listSessions,
  recomputeStats,
  renameSession,
  restoreSession,
  setSessionStatus,
  softDeleteSession,
} from "@/lib/repos/sessions";

let db: Db;
const at = (n: number) => () => new Date(Date.UTC(2026, 0, 1, 0, 0, n));
const mk = (userId: string, n: number) =>
  createSession(db, { userId, question: `q${n}`, mode: "ask", settingsSnapshot: { a: n } }, at(n));

beforeEach(() => {
  db = createTestDb();
  for (const id of ["u1", "u2"])
    db.insert(users)
      .values({ id, email: `${id}@x`, passwordHash: "h", createdAt: "t" })
      .run();
});

describe("sessions repo", () => {
  it("creates and gets a frozen session; other user gets null", () => {
    const s = mk("u1", 1);
    const got = getSession(db, "u1", s.id);
    expect(Object.isFrozen(s)).toBe(true);
    expect(got).toEqual(s);
    expect(got).toMatchObject({ status: "queued", settingsSnapshot: { a: 1 }, title: null });
    expect(getSession(db, "u2", s.id)).toBeNull();
  });

  it("lists newest first, excludes deleted, honours before cursor", () => {
    const [a, b, c, d] = [1, 2, 3, 4].map((n) => mk("u1", n));
    mk("u2", 5);
    softDeleteSession(db, "u1", d!.id, at(9));
    const all = listSessions(db, "u1", { limit: 10 });
    expect(all.map((s) => s.id)).toEqual([c!.id, b!.id, a!.id]);
    const page = listSessions(db, "u1", { limit: 10, before: c!.createdAt });
    expect(page.map((s) => s.id)).toEqual([b!.id, a!.id]);
    expect(listSessions(db, "u1", { limit: 1 })).toHaveLength(1);
  });

  it("renames immutably", () => {
    const s = mk("u1", 1);
    const r = renameSession(db, "u1", s.id, "New", at(5));
    expect(r).toMatchObject({ title: "New", updatedAt: at(5)().toISOString() });
    expect(Object.isFrozen(r)).toBe(true);
    expect(s.title).toBeNull();
    expect(renameSession(db, "u2", s.id, "x")).toBeNull();
  });

  it("soft deletes and restores", () => {
    const s = mk("u1", 1);
    expect(softDeleteSession(db, "u2", s.id)).toBe(false);
    expect(restoreSession(db, "u1", s.id)).toBeNull();
    expect(softDeleteSession(db, "u1", s.id, at(3))).toBe(true);
    expect(getSession(db, "u1", s.id)).toBeNull();
    expect(listDeletedSessions(db, "u1").map((x) => x.id)).toEqual([s.id]);
    expect(listDeletedSessions(db, "u1")[0]!.deletedAt).not.toBeNull();
    expect(restoreSession(db, "u1", s.id)?.deletedAt).toBeNull();
    expect(listSessions(db, "u1", { limit: 5 })).toHaveLength(1);
  });

  it("sets status", () => {
    const s = mk("u1", 1);
    setSessionStatus(db, s.id, "running", at(4));
    expect(getSession(db, "u1", s.id)?.status).toBe("running");
  });

  it("recomputes stats from the latest run and persists status", () => {
    const s = mk("u1", 1);
    const old = createRun(db, s.id, "initial", at(1));
    createCall(db, {
      runId: old.id,
      kind: "answer",
      provider: "claude",
      transport: "mock",
      model: "m",
    });
    const run = createRun(db, s.id, "manual", at(2));
    const base = { runId: run.id, transport: "mock", model: "m" } as const;
    const a = createCall(db, { ...base, kind: "answer", provider: "claude" });
    const b = createCall(db, { ...base, kind: "answer", provider: "chatgpt" });
    updateCall(db, a.id, { status: "done", searches: 2, durationMs: 50, costUsd: 0.5 });
    updateCall(db, b.id, { status: "failed", durationMs: 10 });
    const claim = { idx: 0, claim: "c", note: null, sourceUrl: null, sourceTitle: null };
    replaceClaims(db, a.id, [
      { ...claim, verdict: "supported" },
      { ...claim, idx: 1, verdict: "disputed" },
    ]);
    const stats = recomputeStats(db, s.id, at(7));
    expect(stats).toMatchObject({
      claims: 2,
      supported: 1,
      disputed: 1,
      calls: 2,
      callsDone: 1,
      searches: 2,
      durationMs: 60,
      costUsd: 0.5,
    });
    expect(Object.isFrozen(stats)).toBe(true);
    const got = getSession(db, "u1", s.id)!;
    expect(got.status).toBe("partial");
    expect(got.stats).toEqual(stats);
  });

  it("falls back to empty stats on garbage JSON", () => {
    const s = mk("u1", 1);
    db.$client.prepare("update sessions set stats = 'nope' where id = ?").run(s.id);
    expect(getSession(db, "u1", s.id)?.stats.claims).toBe(0);
    db.$client.prepare('update sessions set stats = \'{"claims":"x"}\' where id = ?').run(s.id);
    expect(getSession(db, "u1", s.id)?.stats).toEqual({ ...EMPTY_STATS });
  });
});
