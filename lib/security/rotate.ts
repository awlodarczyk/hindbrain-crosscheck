import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { providerSecrets } from "@/lib/db/schema-auth";
import { decrypt, deriveKey, encrypt } from "./crypto";

export const MIN_SECRET_CHARS = 32;

/**
 * Re-encrypts every provider secret from `oldSecret` to `newSecret` in one transaction.
 * @returns the number of rows rotated.
 * @throws Error when `newSecret` is shorter than 32 characters or equals `oldSecret`; CryptoError
 * when any row fails to decrypt (nothing is changed).
 */
export function rotateSecrets(db: Db, oldSecret: string, newSecret: string): number {
  if (newSecret.length < MIN_SECRET_CHARS) {
    throw new Error(`New secret must be at least ${MIN_SECRET_CHARS} characters.`);
  }
  if (oldSecret === newSecret) throw new Error("New secret must differ from the old one.");
  const oldKey = deriveKey(oldSecret, "secrets");
  const newKey = deriveKey(newSecret, "secrets");
  return db.transaction(() => {
    const rows = db.select().from(providerSecrets).all();
    for (const row of rows) {
      const next = encrypt(newKey, decrypt(oldKey, row));
      db.update(providerSecrets)
        .set(next)
        .where(
          and(eq(providerSecrets.userId, row.userId), eq(providerSecrets.provider, row.provider)),
        )
        .run();
    }
    return rows.length;
  });
}
