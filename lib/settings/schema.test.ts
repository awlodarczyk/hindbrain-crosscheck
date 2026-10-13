import { describe, expect, it } from "vitest";
import { SettingsSchema } from "./schema";
import { DEFAULT_SETTINGS } from "./defaults";

describe("SettingsSchema", () => {
  it("parses {} to the defaults", () => {
    expect(SettingsSchema.parse({})).toEqual(DEFAULT_SETTINGS);
  });
  it("rejects over-long custom instructions", () => {
    expect(
      SettingsSchema.safeParse({ tuning: { customInstructions: "x".repeat(1001) } }).success,
    ).toBe(false);
  });
  it("validates preferred domains", () => {
    expect(
      SettingsSchema.safeParse({ tuning: { preferredDomains: ["not a domain"] } }).success,
    ).toBe(false);
    expect(SettingsSchema.safeParse({ tuning: { preferredDomains: ["pubmed.gov"] } }).success).toBe(
      true,
    );
  });
  it("rejects more than 5 few-shot entries", () => {
    const fewShot = Array.from({ length: 6 }, () => ({ question: "q", answer: "a" }));
    expect(SettingsSchema.safeParse({ tuning: { fewShot } }).success).toBe(false);
  });
  it("rejects temperature above 1", () => {
    expect(SettingsSchema.safeParse({ tuning: { temperature: 1.5 } }).success).toBe(false);
  });
});
