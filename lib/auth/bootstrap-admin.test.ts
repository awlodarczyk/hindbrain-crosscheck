import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { listUserEvents } from "@/lib/repos/events";
import { countUsers, findUserByEmail } from "@/lib/repos/users";
import { bootstrapAdmin } from "./bootstrap-admin";
import { verifyPassword } from "./password";

const admin = { ADMIN_EMAIL: "Admin@Example.test", ADMIN_PASSWORD: "correct-horse-battery" };

describe("bootstrapAdmin", () => {
  it("creates once, then reports exists without updating", async () => {
    const db = createTestDb();
    expect(bootstrapAdmin(db, admin)).toBe("created");
    const user = findUserByEmail(db, "admin@example.test");
    expect(user && (await verifyPassword(user.passwordHash, admin.ADMIN_PASSWORD))).toBe(true);
    expect(listUserEvents(db, user?.id ?? "", "admin_bootstrapped")).toHaveLength(1);
    expect(bootstrapAdmin(db, { ...admin, ADMIN_PASSWORD: "another-long-password" })).toBe(
      "exists",
    );
    expect(findUserByEmail(db, admin.ADMIN_EMAIL)?.passwordHash).toBe(user?.passwordHash);
  });
  it("skips when unset", () => {
    const db = createTestDb();
    expect(bootstrapAdmin(db, { ADMIN_EMAIL: undefined, ADMIN_PASSWORD: undefined })).toBe(
      "skipped",
    );
    expect(bootstrapAdmin(db, { ADMIN_EMAIL: "a@b.test", ADMIN_PASSWORD: undefined })).toBe(
      "skipped",
    );
    expect(countUsers(db)).toBe(0);
  });
});
