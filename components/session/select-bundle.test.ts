import { describe, expect, it } from "vitest";
import { makeDetail } from "./fixtures";
import { selectLatest, uniqueSources } from "./select-bundle";

describe("selectLatest", () => {
  it("defaults to the highest attempt", () => {
    const v = selectLatest(makeDetail());
    expect(v.run?.id).toBe("r2");
    expect(v.attempts).toEqual([1, 2]);
    expect(v.answers.claude?.id).toBe("c1");
    expect(v.answers.chatgpt?.id).toBe("c2");
  });
  it("keys reviews by the provider that wrote them", () => {
    const v = selectLatest(makeDetail());
    expect(v.reviews.chatgpt?.id).toBe("c3");
    expect(v.reviews.claude?.id).toBe("c4");
  });
  it("selects an explicit attempt", () => {
    const v = selectLatest(makeDetail(), 1);
    expect(v.run?.id).toBe("r1");
    expect(v.answers.claude?.id).toBe("old");
    expect(v.answers.chatgpt).toBeNull();
  });
  it("groups claims per call ordered by idx", () => {
    const v = selectLatest(makeDetail());
    expect(v.claimsByCall["c3"]?.map((c) => c.id)).toEqual(["k0", "k1"]);
    expect(v.claimsByCall["c4"]).toHaveLength(1);
  });
  it("handles a session with no runs", () => {
    const d = { ...makeDetail(), runs: [], calls: [], claims: [] };
    const v = selectLatest(d);
    expect(v.run).toBeNull();
    expect(v.attempts).toEqual([]);
  });
});

describe("uniqueSources", () => {
  it("dedupes by url and records who cited it", () => {
    const v = selectLatest(makeDetail());
    const calls = [...Object.values(v.answers), ...Object.values(v.reviews)].filter((c) => c);
    const s = uniqueSources(calls as never);
    expect(s.map((x) => x.url)).toEqual(["https://www.nasa.gov/moon", "https://esa.int/moon"]);
    expect(s[0]?.domain).toBe("nasa.gov");
    expect(s[0]?.citedBy).toEqual([
      { kind: "answer", provider: "claude" },
      { kind: "answer", provider: "chatgpt" },
    ]);
  });
});
