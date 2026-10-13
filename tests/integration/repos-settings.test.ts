import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/client";
import { settings as settingsTable } from "@/lib/db/schema-auth";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { getSettings, getSettingsWithWarnings, putSettings } from "@/lib/repos/settings";
import { deleteSecret, getSecret, hasSecret, listSecretRows, putSecret } from "@/lib/repos/secrets";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { CryptoError, deriveKey } from "@/lib/security/crypto";

const key = deriveKey("a".repeat(32), "secrets");
let db: Db;
beforeEach(() => {
  db = createTestDb();
  ensureLocalUser(db);
});

describe("settings repo", () => {
  it("returns defaults on empty db", () => {
    expect(getSettings(db, LOCAL_USER_ID)).toEqual(DEFAULT_SETTINGS);
    expect(getSettingsWithWarnings(db, LOCAL_USER_ID).updatedAt).toBeNull();
  });
  it("roundtrips", () => {
    const s = { ...DEFAULT_SETTINGS, answerLanguage: "pl" as const };
    expect(Object.isFrozen(putSettings(db, LOCAL_USER_ID, s))).toBe(true);
    expect(getSettings(db, LOCAL_USER_ID).answerLanguage).toBe("pl");
    putSettings(db, LOCAL_USER_ID, DEFAULT_SETTINGS);
    expect(getSettings(db, LOCAL_USER_ID).answerLanguage).toBe("auto");
  });
  it("falls back with warnings on garbage json", () => {
    db.insert(settingsTable).values({ userId: LOCAL_USER_ID, json: "{nope", updatedAt: "t" }).run();
    const r = getSettingsWithWarnings(db, LOCAL_USER_ID);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("secrets repo", () => {
  it("put/get/has/delete/upsert", () => {
    expect(hasSecret(db, LOCAL_USER_ID, "claude")).toBe(false);
    expect(getSecret(db, key, LOCAL_USER_ID, "claude")).toBeNull();
    putSecret(db, key, LOCAL_USER_ID, "claude", "sk-one");
    putSecret(db, key, LOCAL_USER_ID, "claude", "sk-two");
    expect(getSecret(db, key, LOCAL_USER_ID, "claude")).toBe("sk-two");
    expect(hasSecret(db, LOCAL_USER_ID, "claude")).toBe(true);
    deleteSecret(db, LOCAL_USER_ID, "claude");
    expect(hasSecret(db, LOCAL_USER_ID, "claude")).toBe(false);
  });
  it("lists metadata only", () => {
    putSecret(db, key, LOCAL_USER_ID, "chatgpt", "sk-x");
    const rows = listSecretRows(db, LOCAL_USER_ID);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(["provider", "updatedAt"]);
  });
  it("throws CryptoError with a different key", () => {
    putSecret(db, key, LOCAL_USER_ID, "claude", "sk-x");
    expect(() =>
      getSecret(db, deriveKey("b".repeat(32), "secrets"), LOCAL_USER_ID, "claude"),
    ).toThrow(CryptoError);
  });
});
