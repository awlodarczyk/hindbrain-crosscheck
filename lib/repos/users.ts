import { count, eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "@/lib/db/client";
import { users } from "@/lib/db/schema-auth";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export const LOCAL_USER_ID = "local";
const LOCAL_EMAIL = "local@localhost";

const normalize = (email: string): string => email.trim().toLowerCase();
const toUser = (row: User): User => Object.freeze({ ...row });

/** Inserts a user with a normalized email. @throws when the email already exists. */
export function createUser(
  db: Db,
  input: { email: string; passwordHash: string },
  now: () => Date = () => new Date(),
): User {
  const row: User = {
    id: ulid(),
    email: normalize(input.email),
    passwordHash: input.passwordHash,
    createdAt: now().toISOString(),
    lastLoginAt: null,
  };
  db.insert(users).values(row).run();
  return toUser(row);
}

export function findUserByEmail(db: Db, email: string): User | null {
  const row = db
    .select()
    .from(users)
    .where(eq(users.email, normalize(email)))
    .get();
  return row ? toUser(row) : null;
}

export function getUser(db: Db, id: string): User | null {
  const row = db.select().from(users).where(eq(users.id, id)).get();
  return row ? toUser(row) : null;
}

/** Returns the single-user-mode account, creating it when missing. */
export function ensureLocalUser(db: Db, now: () => Date = () => new Date()): User {
  db.insert(users)
    .values({
      id: LOCAL_USER_ID,
      email: LOCAL_EMAIL,
      passwordHash: "",
      createdAt: now().toISOString(),
      lastLoginAt: null,
    })
    .onConflictDoNothing()
    .run();
  const user = getUser(db, LOCAL_USER_ID);
  if (!user) throw new Error("local user missing after insert");
  return user;
}

export function updatePasswordHash(db: Db, id: string, hash: string): void {
  db.update(users).set({ passwordHash: hash }).where(eq(users.id, id)).run();
}

export function touchLogin(db: Db, id: string, now: () => Date = () => new Date()): void {
  db.update(users).set({ lastLoginAt: now().toISOString() }).where(eq(users.id, id)).run();
}

export function countUsers(db: Db): number {
  return db.select({ n: count() }).from(users).get()?.n ?? 0;
}
