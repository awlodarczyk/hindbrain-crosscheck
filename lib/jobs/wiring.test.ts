import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/client";
import { resetEnvForTests } from "@/lib/env";
import { log } from "@/lib/log";
import { providersForUser } from "./wiring";
import { putSecret } from "@/lib/repos/secrets";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { deriveKey } from "@/lib/security/crypto";
import { providerSecrets } from "@/lib/db/schema";

let db: Db;

beforeEach(() => {
  db = createTestDb();
  ensureLocalUser(db);
  putSecret(
    db,
    deriveKey("test-secret-32-bytes-minimum-length!!", "secrets"),
    LOCAL_USER_ID,
    "claude",
    "sk-x",
  );
  db.update(providerSecrets).set({ ciphertext: "AAAA" }).run();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
  vi.restoreAllMocks();
});

describe("providersForUser", () => {
  it("falls back to no key and warns when a stored secret is corrupt", async () => {
    vi.stubEnv("PROVIDER_TRANSPORT", "auto");
    resetEnvForTests();
    const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    const providers = await providersForUser(db, LOCAL_USER_ID);
    expect(Object.keys(providers).sort()).toEqual(["chatgpt", "claude"]);
    expect(warn).toHaveBeenCalledWith(
      { provider: "claude", userId: LOCAL_USER_ID },
      expect.any(String),
    );
  });

  it("does not read secrets with the mock transport", async () => {
    vi.stubEnv("PROVIDER_TRANSPORT", "mock");
    resetEnvForTests();
    const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    await providersForUser(db, LOCAL_USER_ID);
    expect(warn).not.toHaveBeenCalled();
  });
});
