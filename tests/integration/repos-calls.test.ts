import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { users } from "@/lib/db/schema";
import { createCall, getCall, listCalls, listCallsForSession, updateCall } from "@/lib/repos/calls";
import { listClaims, listClaimsForCalls, replaceClaims } from "@/lib/repos/claims";
import { createRun, finishRun, latestRun, listRuns, setRunStatus } from "@/lib/repos/runs";
import { createSession } from "@/lib/repos/sessions";
import type { NewClaim } from "@/lib/repos/types";

let db: Db;
let sid: string;
const base = { transport: "mock", model: "m" } as const;
const nc = (idx: number, claim: string): NewClaim => ({
  idx,
  claim,
  verdict: "supported",
  note: null,
  sourceUrl: null,
  sourceTitle: null,
});

beforeEach(() => {
  db = createTestDb();
  db.insert(users).values({ id: "u", email: "u@x", passwordHash: "h", createdAt: "t" }).run();
  sid = createSession(db, { userId: "u", question: "q", mode: "ask", settingsSnapshot: {} }).id;
});

describe("runs", () => {
  it("increments attempt, finds latest, finishes", () => {
    expect(latestRun(db, sid)).toBeNull();
    const r1 = createRun(db, sid, "initial");
    const r2 = createRun(db, sid, "manual");
    expect([r1.attempt, r2.attempt, r1.status]).toEqual([1, 2, "queued"]);
    expect(Object.isFrozen(r1)).toBe(true);
    expect(latestRun(db, sid)?.id).toBe(r2.id);
    setRunStatus(db, r2.id, "running");
    finishRun(db, r2.id, "done", () => new Date(0));
    expect(listRuns(db, sid).map((r) => r.attempt)).toEqual([1, 2]);
    expect(latestRun(db, sid)).toMatchObject({
      status: "done",
      finishedAt: "1970-01-01T00:00:00.000Z",
    });
  });
});

describe("calls", () => {
  it("applies defaults", () => {
    const run = createRun(db, sid, "initial");
    const c = createCall(db, { ...base, runId: run.id, kind: "answer", provider: "claude" });
    expect(Object.isFrozen(c)).toBe(true);
    expect(c).toMatchObject({
      status: "queued",
      searches: 0,
      citations: [],
      pasted: false,
      text: null,
      costUsd: null,
    });
    expect(getCall(db, "nope")).toBeNull();
  });

  it("updateCall returns merged copy with roundtripped json/bool", () => {
    const run = createRun(db, sid, "initial");
    const c = createCall(db, { ...base, runId: run.id, kind: "answer", provider: "claude" });
    const u = updateCall(db, c.id, {
      status: "done",
      pasted: true,
      citations: [{ title: "T", url: "http://x" }],
      text: "hi",
    });
    expect(u).toMatchObject({ status: "done", pasted: true, text: "hi", model: "m" });
    expect(u.citations).toEqual([{ title: "T", url: "http://x" }]);
    expect(c.status).toBe("queued");
    expect(getCall(db, c.id)).toEqual(u);
    db.$client.prepare("update calls set citations = '{bad' where id = ?").run(c.id);
    expect(getCall(db, c.id)?.citations).toEqual([]);
    db.$client.prepare("update calls set citations = '[{\"title\":1}]' where id = ?").run(c.id);
    expect(getCall(db, c.id)?.citations).toEqual([]);
    expect(Object.isFrozen(u.citations[0])).toBe(true);
    expect(() => updateCall(db, "missing", {})).toThrow();
  });

  it("orders session calls by attempt then insertion", () => {
    const r1 = createRun(db, sid, "initial");
    const r2 = createRun(db, sid, "manual");
    const mk = (runId: string, provider: "claude" | "chatgpt") =>
      createCall(db, { ...base, runId, kind: "answer", provider });
    const b = mk(r2.id, "claude");
    const a1 = mk(r1.id, "claude");
    const a2 = mk(r1.id, "chatgpt");
    expect(listCallsForSession(db, sid).map((c) => c.id)).toEqual([a1.id, a2.id, b.id]);
    expect(listCalls(db, r1.id).map((c) => c.id)).toEqual([a1.id, a2.id]);
  });
});

describe("claims", () => {
  it("replaceClaims keeps only the second set in idx order", () => {
    const run = createRun(db, sid, "initial");
    const c = createCall(db, { ...base, runId: run.id, kind: "review", provider: "claude" });
    const d = createCall(db, { ...base, runId: run.id, kind: "review", provider: "chatgpt" });
    replaceClaims(db, c.id, [nc(0, "old")]);
    const out = replaceClaims(db, c.id, [nc(1, "b"), nc(0, "a")]);
    expect(out.map((x) => x.claim)).toEqual(["a", "b"]);
    expect(Object.isFrozen(out[0])).toBe(true);
    expect(listClaims(db, c.id).map((x) => x.claim)).toEqual(["a", "b"]);
    replaceClaims(db, d.id, [nc(0, "z")]);
    expect(listClaimsForCalls(db, [c.id, d.id])).toHaveLength(3);
    expect(listClaimsForCalls(db, [])).toEqual([]);
  });
});
