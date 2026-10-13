import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/client";
import { authSessions } from "@/lib/db/schema-auth";
import { createUser } from "@/lib/repos/users";
import {
  createAuthSession,
  MAX_SESSIONS_PER_USER,
  readAuthSession,
  revokeAllSessions,
  revokeAuthSession,
  SESSION_RENEW_BELOW_MS,
  SESSION_TTL_MS,
} from "./session";

let db: Db;
let userId: string;
const meta = { ip: "1.2.3.4", ua: "vitest" };
const at = (ms: number) => () => new Date(ms);
const T0 = Date.parse("2026-01-01T00:00:00Z");

beforeEach(() => {
  db = createTestDb();
  userId = createUser(db, { email: "a@example.test", passwordHash: "x" }).id;
});

describe("auth sessions", () => {
  it("creates and reads a session", () => {
    const { token, expiresAt } = createAuthSession(db, userId, meta, at(T0));
    expect(expiresAt).toBe(new Date(T0 + SESSION_TTL_MS).toISOString());
    const s = readAuthSession(db, token, at(T0 + 1000));
    expect(s).toMatchObject({ userId, renewed: false });
  });
  it("never stores the token in plaintext", () => {
    const { token } = createAuthSession(db, userId, meta);
    const row = db.select().from(authSessions).get();
    expect(row?.tokenHash).not.toBe(token);
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("returns null for unknown or missing tokens", () => {
    expect(readAuthSession(db, "nope")).toBeNull();
    expect(readAuthSession(db, undefined)).toBeNull();
  });
  it("deletes an expired session", () => {
    const { token } = createAuthSession(db, userId, meta, at(T0));
    expect(readAuthSession(db, token, at(T0 + SESSION_TTL_MS + 1))).toBeNull();
    expect(db.select().from(authSessions).all()).toHaveLength(0);
  });
  it("renews below the threshold", () => {
    const { token } = createAuthSession(db, userId, meta, at(T0));
    const later = T0 + SESSION_TTL_MS - SESSION_RENEW_BELOW_MS + 1000;
    expect(readAuthSession(db, token, at(later))?.renewed).toBe(true);
    expect(db.select().from(authSessions).get()?.expiresAt).toBe(
      new Date(later + SESSION_TTL_MS).toISOString(),
    );
  });
  it("revokes one and all", () => {
    const a = createAuthSession(db, userId, meta);
    createAuthSession(db, userId, meta);
    revokeAuthSession(db, a.token);
    expect(readAuthSession(db, a.token)).toBeNull();
    expect(revokeAllSessions(db, userId)).toBe(1);
  });
  it("prunes the oldest sessions beyond the cap", () => {
    const tokens = Array.from(
      { length: MAX_SESSIONS_PER_USER + 2 },
      (_, i) => createAuthSession(db, userId, meta, at(T0 + i * 1000)).token,
    );
    expect(db.select().from(authSessions).all()).toHaveLength(MAX_SESSIONS_PER_USER);
    expect(readAuthSession(db, tokens[0], at(T0))).toBeNull();
    expect(readAuthSession(db, tokens.at(-1), at(T0))).not.toBeNull();
  });
});
