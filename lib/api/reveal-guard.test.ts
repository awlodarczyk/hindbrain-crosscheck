import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPasswordSync } from "@/lib/auth/password";
import { createTestDb } from "@/lib/db/test-db";
import { resetEnvForTests } from "@/lib/env";
import { createUser } from "@/lib/repos/users";
import { verifyRevealPassword } from "./reveal-guard";

// Exception to "process.env only via lib/env.ts": the env singleton is parsed from process.env on first access.
const ORIGINAL = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, {
    APP_MODE: "hosted",
    APP_URL: "https://app.example.com",
    VALKEY_URL: "memory://local",
    ADMIN_EMAIL: "admin@example.com",
    ADMIN_PASSWORD: "correct horse battery staple",
  });
  resetEnvForTests();
});
afterEach(() => {
  process.env = { ...ORIGINAL };
  resetEnvForTests();
});

describe("verifyRevealPassword (hosted)", () => {
  const db = createTestDb();
  const user = createUser(db, {
    email: "a@example.test",
    passwordHash: hashPasswordSync("right-password-1"),
  });

  it("accepts the account password", async () => {
    await expect(verifyRevealPassword(db, user.id, "right-password-1")).resolves.toBe(true);
  });
  it("rejects a wrong password and an unknown user with 403", async () => {
    await expect(verifyRevealPassword(db, user.id, "nope-nope-nope")).rejects.toMatchObject({
      status: 403,
      code: "invalid_password",
    });
    await expect(verifyRevealPassword(db, "ghost", "x")).rejects.toMatchObject({ status: 403 });
  });
});
