import { describe, expect, it } from "vitest";
import { makeCall, makeDetail, makeSession } from "./fixtures";
import { callMeta, domainOf, metaLine } from "./meta-line";
import { selectLatest } from "./select-bundle";

describe("metaLine", () => {
  it("joins date, models, counts and seconds", () => {
    const view = selectLatest(makeDetail());
    const line = metaLine(makeSession(), view, "en-GB", "UTC");
    expect(line).toBe(
      "12 Oct 2026 · 14:32 · claude-opus-5-5 vs gpt-5.5 · 4 calls · 4 searches · 50 s",
    );
  });
});

describe("callMeta", () => {
  it("formats duration and searches", () => {
    expect(callMeta(makeCall())).toBe("12.4 s · 1 search");
    expect(callMeta(makeCall({ searches: 2 }))).toBe("12.4 s · 2 searches");
    expect(callMeta(makeCall({ searches: 0, durationMs: 3000 }))).toBe("3.0 s");
  });
  it("covers states", () => {
    expect(callMeta(makeCall({ status: "running", searches: 0 }))).toBe("running");
    expect(callMeta(makeCall({ status: "running", searches: 2 }))).toBe("running · 2 searches");
    expect(callMeta(makeCall({ status: "queued" }))).toBe("queued");
    expect(callMeta(makeCall({ status: "failed" }))).toBe("failed");
    expect(callMeta(makeCall({ pasted: true }))).toBe("pasted");
  });
});

describe("domainOf", () => {
  it("strips www", () => {
    expect(domainOf("https://www.nasa.gov/a?b")).toBe("nasa.gov");
    expect(domainOf("https://esa.int")).toBe("esa.int");
    expect(domainOf("not a url")).toBe("not a url");
  });
});

describe("metaLine while running", () => {
  it("shows progress", () => {
    const detail = makeDetail();
    const session = {
      ...detail.session,
      status: "running" as const,
      stats: { ...detail.session.stats, calls: 4, callsDone: 1 },
    };
    const line = metaLine(session, selectLatest({ ...detail, session }), "en-GB", "UTC");
    expect(line).toMatch(/^Running · started \d\d:\d\d · .* · 1 of 4 calls done$/);
  });
});
