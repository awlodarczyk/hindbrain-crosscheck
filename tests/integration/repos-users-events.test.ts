import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/client";
import {
  countUsers,
  createUser,
  ensureLocalUser,
  findUserByEmail,
  getUser,
  LOCAL_USER_ID,
  touchLogin,
  updatePasswordHash,
} from "@/lib/repos/users";
import { sessions } from "@/lib/db/schema-sessions";
import { events } from "@/lib/db/schema-sessions";
import { appendEvent, listEvents, listUserEvents } from "@/lib/repos/events";

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe("users repo", () => {
  it("normalises email and finds case-insensitively", () => {
    const u = createUser(db, { email: "  Foo@Bar.COM ", passwordHash: "h" });
    expect(u.email).toBe("foo@bar.com");
    expect(Object.isFrozen(u)).toBe(true);
    expect(findUserByEmail(db, "FOO@bar.com")?.id).toBe(u.id);
    expect(getUser(db, u.id)).toEqual(u);
  });
  it("rejects duplicate email", () => {
    createUser(db, { email: "a@b.co", passwordHash: "h" });
    expect(() => createUser(db, { email: "A@b.co", passwordHash: "h" })).toThrow();
  });
  it("ensureLocalUser is idempotent", () => {
    const a = ensureLocalUser(db);
    const b = ensureLocalUser(db);
    expect(a.id).toBe(LOCAL_USER_ID);
    expect(b).toEqual(a);
    expect(countUsers(db)).toBe(1);
  });
  it("touchLogin and updatePasswordHash", () => {
    const u = createUser(db, { email: "a@b.co", passwordHash: "h" });
    touchLogin(db, u.id, () => new Date("2026-01-01T00:00:00Z"));
    updatePasswordHash(db, u.id, "h2");
    const got = getUser(db, u.id);
    expect(got?.lastLoginAt).toBe("2026-01-01T00:00:00.000Z");
    expect(got?.passwordHash).toBe("h2");
  });
});

describe("events repo", () => {
  const seedSession = (id: string): void => {
    db.insert(sessions)
      .values({
        id,
        userId: LOCAL_USER_ID,
        question: "q",
        mode: "ask",
        status: "queued",
        settingsSnapshot: "{}",
        createdAt: "t",
        updatedAt: "t",
      })
      .run();
  };
  beforeEach(() => {
    ensureLocalUser(db);
    seedSession("s1");
  });
  const u = LOCAL_USER_ID;
  const at = (s: string) => () => new Date(s);

  it("lists by session in ts order and filters user events by type", () => {
    appendEvent(
      db,
      { sessionId: "s1", userId: u, type: "b", payload: { n: 2 } },
      at("2026-01-02T00:00:00Z"),
    );
    appendEvent(db, { sessionId: "s1", userId: u, type: "a" }, at("2026-01-01T00:00:00Z"));
    appendEvent(
      db,
      { sessionId: null, userId: u, type: "a", payload: 1 },
      at("2026-01-03T00:00:00Z"),
    );
    const list = listEvents(db, "s1");
    expect(list.map((e) => e.type)).toEqual(["a", "b"]);
    expect(list[1]?.payload).toEqual({ n: 2 });
    expect(Object.isFrozen(list)).toBe(true);
    expect(Object.isFrozen(list[1]?.payload)).toBe(true);
    expect(listUserEvents(db, u, "a")).toHaveLength(2);
  });
  it("rejects a nonexistent session", () => {
    expect(() => appendEvent(db, { sessionId: "nope", userId: u, type: "a" })).toThrow();
  });
  it("nulls session_id when the session is deleted", () => {
    const e = appendEvent(db, { sessionId: "s1", userId: u, type: "a" });
    db.delete(sessions).where(eq(sessions.id, "s1")).run();
    expect(listUserEvents(db, u, "a")[0]?.sessionId).toBeNull();
    expect(listUserEvents(db, u, "a")[0]?.id).toBe(e.id);
  });
  it("returns null payload for corrupt json", () => {
    db.insert(events)
      .values({ id: "e1", sessionId: null, userId: u, ts: "t", type: "x", payload: "{bad" })
      .run();
    expect(listUserEvents(db, u, "x")[0]?.payload).toBeNull();
  });
});
