import { describe, expect, it } from "vitest";
import { DeleteSecretBody, ProviderParam, PutSecretBody, RevealBody } from "./settings-dto";

const KEY = "sk-ant-abcdefghijklmnopqrstuvwxyz";

describe("PutSecretBody", () => {
  it("accepts a printable ascii key", () => {
    expect(PutSecretBody.safeParse({ provider: "claude", apiKey: KEY }).success).toBe(true);
  });
  it("rejects short, long, non-ascii and spaced keys", () => {
    for (const apiKey of ["short", "a".repeat(401), `${KEY}é`, `${KEY} x`]) {
      expect(PutSecretBody.safeParse({ provider: "claude", apiKey }).success).toBe(false);
    }
  });
  it("rejects unknown providers", () => {
    expect(PutSecretBody.safeParse({ provider: "gemini", apiKey: KEY }).success).toBe(false);
  });
});

describe("RevealBody / DeleteSecretBody / ProviderParam", () => {
  it("password is optional", () => {
    expect(RevealBody.safeParse({ provider: "chatgpt" }).success).toBe(true);
    expect(RevealBody.safeParse({ provider: "chatgpt", password: "x" }).success).toBe(true);
  });
  it("validates provider ids", () => {
    expect(DeleteSecretBody.safeParse({ provider: "claude" }).success).toBe(true);
    expect(ProviderParam.safeParse("nope").success).toBe(false);
  });
});
