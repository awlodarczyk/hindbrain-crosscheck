import { describe, expect, it } from "vitest";
import { extractUrls } from "./cli-citations";

describe("extractUrls", () => {
  it("handles pathological trailing punctuation quickly", () => {
    const t = Date.now();
    extractUrls("http://a.com/" + ".".repeat(100_000) + "x");
    expect(Date.now() - t).toBeLessThan(50);
  });
  it("caps url length", () => {
    const [c] = extractUrls(`http://a.com/${"b".repeat(5000)}`);
    expect(c?.url.length).toBeLessThanOrEqual(2048);
  });
});
