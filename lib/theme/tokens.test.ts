import { describe, expect, it } from "vitest";
import { TOKENS, tokensToCss } from "./tokens";

describe("tokens", () => {
  it("has the 19 App variables from Figma", () => expect(TOKENS).toHaveLength(19));
  it("every value is an uppercase 6-digit hex", () => {
    for (const t of TOKENS) {
      expect(t.light).toMatch(/^#[0-9A-F]{6}$/);
      expect(t.dark).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
  it("css names derive from token names", () => {
    for (const t of TOKENS) expect(t.css).toBe("--" + t.name.replace("/", "-"));
  });
  it("renders css custom properties", () => {
    expect(tokensToCss("dark")).toContain("--bg-page: #09090B;");
    expect(tokensToCss("light")).toContain("--accent-default: #4F46E5;");
  });
});
