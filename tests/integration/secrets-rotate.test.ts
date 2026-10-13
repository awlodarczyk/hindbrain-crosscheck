import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { providerSecrets } from "@/lib/db/schema-auth";
import { getSecret, putSecret } from "@/lib/repos/secrets";
import { createUser } from "@/lib/repos/users";
import { deriveKey } from "@/lib/security/crypto";
import { rotateSecrets } from "@/lib/security/rotate";

const OLD = "o".repeat(40);
const NEW = "n".repeat(40);
const key = (s: string) => deriveKey(s, "secrets");

function seed() {
  const db = createTestDb();
  const u = createUser(db, { email: "a@example.com", passwordHash: "x" }).id;
  putSecret(db, key(OLD), u, "claude", "sk-claude");
  putSecret(db, key(OLD), u, "chatgpt", "sk-chatgpt");
  return { db, u };
}

describe("rotateSecrets", () => {
  it("re-encrypts every row under the new secret", () => {
    const { db, u } = seed();
    expect(rotateSecrets(db, OLD, NEW)).toBe(2);
    expect(getSecret(db, key(NEW), u, "claude")).toBe("sk-claude");
    expect(getSecret(db, key(NEW), u, "chatgpt")).toBe("sk-chatgpt");
    expect(() => getSecret(db, key(OLD), u, "claude")).toThrow();
  });

  it("rolls back everything when one row is corrupt", () => {
    const { db, u } = seed();
    db.update(providerSecrets)
      .set({ tag: "AAAA" })
      .where(eq(providerSecrets.provider, "chatgpt"))
      .run();
    expect(() => rotateSecrets(db, OLD, NEW)).toThrow();
    expect(getSecret(db, key(OLD), u, "claude")).toBe("sk-claude");
  });

  it("refuses short or identical secrets", () => {
    const { db } = seed();
    expect(() => rotateSecrets(db, OLD, "short")).toThrow(/32/);
    expect(() => rotateSecrets(db, OLD, OLD)).toThrow(/differ/);
  });
});
