import { describe, expect, it } from "vitest";
import { makeBundle, SESSION_BUNDLE } from "../../tests/fixtures/session-bundle";
import { buildMarkdownReport, escapeMdCell, latestRunView } from "./report";

const now = new Date("2026-10-13T10:00:00.000Z");
const withCall = (id: string, patch: object) =>
  makeBundle({ calls: SESSION_BUNDLE.calls.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

describe("buildMarkdownReport", () => {
  it("matches snapshot", () => {
    expect(buildMarkdownReport(SESSION_BUNDLE, { now })).toMatchSnapshot();
  });

  it("has H1, sections, table row and sources", () => {
    const md = buildMarkdownReport(SESSION_BUNDLE, { now });
    expect(md).toMatch(/^# Does static stretching before training reduce injury risk\?/);
    for (const h of [
      "## Claude answer",
      "## ChatGPT answer",
      "## ChatGPT checks Claude",
      "## Claude checks ChatGPT",
      "## Sources",
    ])
      expect(md).toContain(h);
    expect(md).toContain("| Disputed |");
    expect(md.match(/\(https:\/\/example\.org\/bjsm-warmup\)/g)?.length).toBeGreaterThanOrEqual(1);
    const sources = md.split("## Sources")[1] ?? "";
    expect(sources.match(/bjsm-warmup/g)).toHaveLength(1);
  });

  it("escapes pipes and newlines in cells", () => {
    const md = buildMarkdownReport(SESSION_BUNDLE, { now });
    expect(md).toContain("muscle strains \\| specifically.");
    expect(md).toContain("sprinters, not general athletes.");
    expect(escapeMdCell("a|b\nc")).toBe("a\\|b c");
  });

  it("renders failed calls and pasted heading", () => {
    const failed = withCall("c3", { status: "failed", errorMessage: "timeout" });
    expect(buildMarkdownReport(failed, { now })).toContain("Not available (failed: timeout)");
    const pasted = withCall("c2", { pasted: true });
    expect(buildMarkdownReport(pasted, { now })).toContain("## ChatGPT answer (pasted)");
  });
});

describe("latestRunView", () => {
  it("picks highest attempt", () => {
    const run2 = { ...SESSION_BUNDLE.runs[0]!, id: "r2", attempt: 2 };
    const call = { ...SESSION_BUNDLE.calls[0]!, id: "c9", runId: "r2", text: "second" };
    const v = latestRunView(
      makeBundle({ runs: [...SESSION_BUNDLE.runs, run2], calls: [...SESSION_BUNDLE.calls, call] }),
    );
    expect(v.run?.attempt).toBe(2);
    expect(v.answers.claude?.text).toBe("second");
    expect(v.answers.chatgpt).toBeNull();
  });
});
