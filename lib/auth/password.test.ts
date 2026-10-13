import { describe, expect, it } from "vitest";
import { getDummyHash, hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("roundtrips an argon2id hash", async () => {
    const h = await hashPassword("correct-horse-battery");
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(h, "correct-horse-battery")).toBe(true);
  });
  it("rejects a wrong password", async () => {
    expect(await verifyPassword(await hashPassword("abcdefgh"), "abcdefgi")).toBe(false);
  });
  it("returns false for a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
    expect(await verifyPassword("", "x")).toBe(false);
  });
  it("dummy hash is stable and never verifies", async () => {
    expect(getDummyHash()).toBe(getDummyHash());
    expect(await verifyPassword(getDummyHash(), "password")).toBe(false);
  });
});
