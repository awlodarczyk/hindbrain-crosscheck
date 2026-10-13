import { asc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "@/lib/db/client";
import { authSessions } from "@/lib/db/schema-auth";
import { randomToken, sha256Hex } from "@/lib/security/crypto";

export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
export const SESSION_RENEW_BELOW_MS = 7 * 24 * 3600 * 1000;
export const MAX_SESSIONS_PER_USER = 5;

type Clock = () => Date;
const defaultClock: Clock = () => new Date();

/** Creates a session and returns the raw token (only its sha256 is stored); prunes the user's oldest beyond the cap. */
export function createAuthSession(
  db: Db,
  userId: string,
  meta: { ip: string; ua: string | null },
  now: Clock = defaultClock,
): { token: string; expiresAt: string } {
  const token = randomToken(32);
  const expiresAt = new Date(now().getTime() + SESSION_TTL_MS).toISOString();
  db.insert(authSessions)
    .values({
      id: ulid(),
      userId,
      tokenHash: sha256Hex(token),
      expiresAt,
      createdAt: now().toISOString(),
      ip: meta.ip,
      ua: meta.ua,
    })
    .run();
  const rows = db
    .select({ id: authSessions.id })
    .from(authSessions)
    .where(eq(authSessions.userId, userId))
    .orderBy(asc(authSessions.createdAt), asc(authSessions.id))
    .all();
  for (const row of rows.slice(0, Math.max(0, rows.length - MAX_SESSIONS_PER_USER))) {
    db.delete(authSessions).where(eq(authSessions.id, row.id)).run();
  }
  return { token, expiresAt };
}

/** Resolves a token to its session; expired rows are deleted, and sessions near expiry are extended. */
export function readAuthSession(
  db: Db,
  token: string | undefined,
  now: Clock = defaultClock,
): { userId: string; sessionId: string; renewed: boolean } | null {
  if (!token) return null;
  const row = db
    .select()
    .from(authSessions)
    .where(eq(authSessions.tokenHash, sha256Hex(token)))
    .get();
  if (!row) return null;
  const remaining = new Date(row.expiresAt).getTime() - now().getTime();
  if (remaining <= 0) {
    db.delete(authSessions).where(eq(authSessions.id, row.id)).run();
    return null;
  }
  const renewed = remaining < SESSION_RENEW_BELOW_MS;
  if (renewed) {
    const expiresAt = new Date(now().getTime() + SESSION_TTL_MS).toISOString();
    db.update(authSessions).set({ expiresAt }).where(eq(authSessions.id, row.id)).run();
  }
  return { userId: row.userId, sessionId: row.id, renewed };
}

export function revokeAuthSession(db: Db, token: string): void {
  db.delete(authSessions)
    .where(eq(authSessions.tokenHash, sha256Hex(token)))
    .run();
}

/** Deletes every session of the user; returns how many were removed. */
export function revokeAllSessions(db: Db, userId: string): number {
  return db.delete(authSessions).where(eq(authSessions.userId, userId)).run().changes;
}
