import { describe, expect, it } from "vitest";
import { costForBody } from "./weights";

describe("costForBody", () => {
  it("weights paste imports by size with a minimum", () => {
    expect(costForBody("paste_import_per_10kb", 95_000)).toBe(10);
    expect(costForBody("paste_import_per_10kb", 1)).toBe(5);
    expect(costForBody("paste_import_per_10kb")).toBe(5);
  });
  it("uses the flat cost otherwise", () => {
    expect(costForBody("ask")).toBe(10);
    expect(costForBody("read", 999_999)).toBe(1);
  });
});
