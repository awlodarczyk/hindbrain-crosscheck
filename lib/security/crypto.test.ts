import { describe, expect, it } from "vitest";
import { CryptoError, decrypt, deriveKey, encrypt, mask, randomToken, sha256Hex } from "./crypto";

const key = deriveKey("test-app-secret-test-app-secret", "secrets");

describe("crypto", () => {
  it("roundtrips", () => {
    expect(decrypt(key, encrypt(key, "hello"))).toBe("hello");
  });
  it("uses a fresh iv each time", () => {
    const a = encrypt(key, "same");
    const b = encrypt(key, "same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
  it("throws CryptoError on tampered tag", () => {
    const enc = encrypt(key, "x");
    const tag = Buffer.from(enc.tag, "base64");
    tag[0] = (tag[0] ?? 0) ^ 1;
    expect(() => decrypt(key, { ...enc, tag: tag.toString("base64") })).toThrow(CryptoError);
  });
  it("derives distinct keys per purpose", () => {
    expect(deriveKey("s".repeat(32), "secrets").equals(deriveKey("s".repeat(32), "cookie"))).toBe(
      false,
    );
    expect(key).toHaveLength(32);
  });
  it("masks", () => {
    expect(mask("sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123a92c")).toBe("sk-ant-••••a92c");
    expect(mask("short")).toBe("••••");
  });
  it("hashes and generates tokens", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
