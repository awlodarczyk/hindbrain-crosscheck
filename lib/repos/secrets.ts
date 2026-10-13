import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import type { ProviderId } from "@/lib/db/enums";
import { providerSecrets } from "@/lib/db/schema-auth";
import { decrypt, encrypt } from "@/lib/security/crypto";

const match = (userId: string, provider: ProviderId) =>
  and(eq(providerSecrets.userId, userId), eq(providerSecrets.provider, provider));

/** Encrypts and upserts a provider secret. */
export function putSecret(
  db: Db,
  key: Buffer,
  userId: string,
  provider: ProviderId,
  plaintext: string,
  now: () => Date = () => new Date(),
): void {
  const values = { ...encrypt(key, plaintext), updatedAt: now().toISOString() };
  db.insert(providerSecrets)
    .values({ userId, provider, ...values })
    .onConflictDoUpdate({ target: [providerSecrets.userId, providerSecrets.provider], set: values })
    .run();
}

/** The only decrypt call site. Returns null when absent. @throws CryptoError when the key is wrong or data tampered. */
export function getSecret(
  db: Db,
  key: Buffer,
  userId: string,
  provider: ProviderId,
): string | null {
  const row = db.select().from(providerSecrets).where(match(userId, provider)).get();
  return row ? decrypt(key, row) : null;
}

export function hasSecret(db: Db, userId: string, provider: ProviderId): boolean {
  return db.select().from(providerSecrets).where(match(userId, provider)).get() !== undefined;
}

export function deleteSecret(db: Db, userId: string, provider: ProviderId): void {
  db.delete(providerSecrets).where(match(userId, provider)).run();
}

/** Metadata only; never ciphertext. */
export function listSecretRows(
  db: Db,
  userId: string,
): readonly { provider: ProviderId; updatedAt: string }[] {
  const rows = db
    .select({ provider: providerSecrets.provider, updatedAt: providerSecrets.updatedAt })
    .from(providerSecrets)
    .where(eq(providerSecrets.userId, userId))
    .all();
  return Object.freeze(rows.map((r) => Object.freeze(r)));
}
