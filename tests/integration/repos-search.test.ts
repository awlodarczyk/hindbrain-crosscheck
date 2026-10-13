import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { sessions, users } from "@/lib/db/schema";
import { indexSession, removeFromIndex, searchSessions } from "@/lib/repos/search";

let db: Db;
const now = "2026-01-01T00:00:00.000Z";

function seed(id: string, userId: string, question: string, answers: string): void {
  db.insert(sessions)
    .values({
      id,
      userId,
      question,
      mode: "ask",
      status: "queued",
      settingsSnapshot: "{}",
      stats: "{}",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  indexSession(db, id, question, answers);
}

beforeEach(() => {
  db = createTestDb();
  for (const id of ["A", "B"]) {
    db.insert(users)
      .values({ id, email: `${id}@x.io`, passwordHash: "h", createdAt: now })
      .run();
  }
  seed(
    "s1",
    "A",
    "Is stretching before running useful?",
    "Evidence suggests hamstring flexibility.",
  );
  seed("s2", "A", "Best sleep schedule?", "Consistent bedtime improves circadian rhythm.");
  seed("s3", "B", "Stretching routines", "Hamstring work for runners.");
});

describe("searchSessions", () => {
  it("finds by question", () => {
    expect(searchSessions(db, "A", "stretching").map((h) => h.id)).toEqual(["s1"]);
  });
  it("finds by answer text with a mark in the snippet", () => {
    const hits = searchSessions(db, "A", "circadian");
    expect(hits.map((h) => h.id)).toEqual(["s2"]);
    expect(hits[0]?.snippet).toContain("<mark>");
  });
  it("is scoped to the user", () => {
    expect(searchSessions(db, "A", "runners")).toEqual([]);
  });
  it("excludes soft-deleted sessions", () => {
    db.update(sessions).set({ deletedAt: now }).where(eq(sessions.id, "s1")).run();
    expect(searchSessions(db, "A", "stretching")).toEqual([]);
  });
  it("drops removed sessions", () => {
    removeFromIndex(db, "s1");
    expect(searchSessions(db, "A", "stretching")).toEqual([]);
  });
  it("survives injection input", () => {
    expect(searchSessions(db, "A", '"); DROP TABLE sessions; --')).toEqual([]);
    expect(db.select().from(sessions).all()).toHaveLength(3);
  });
  it("returns [] for an empty query", () => {
    expect(searchSessions(db, "A", "")).toEqual([]);
  });
  it("does not duplicate on re-index", () => {
    indexSession(db, "s1", "Is stretching before running useful?", "again");
    expect(searchSessions(db, "A", "stretching")).toHaveLength(1);
  });
});
