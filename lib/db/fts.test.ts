import { describe, expect, it } from "vitest";
import { escapeFtsQuery } from "./fts";

describe("escapeFtsQuery", () => {
  it("quotes each token", () => {
    expect(escapeFtsQuery("stretch injury")).toBe('"stretch" "injury"');
  });
  it("doubles internal quotes", () => {
    expect(escapeFtsQuery('say "hi"')).toBe('"say" """hi"""');
  });
  it("returns empty for blank input", () => {
    expect(escapeFtsQuery("   ")).toBe("");
    expect(escapeFtsQuery("")).toBe("");
  });
  it("neutralises injection strings", () => {
    const out = escapeFtsQuery('"); DROP TABLE sessions; --');
    const tokens = out.match(/"(?:[^"]|"")*"/g) ?? [];
    expect(tokens.join(" ")).toBe(out);
    expect(out.replace(/"(?:[^"]|"")*"/g, "")).not.toMatch(/[;)]/);
  });
});
