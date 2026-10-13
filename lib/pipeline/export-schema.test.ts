import { describe, expect, it } from "vitest";
import { makeBundle, SESSION_BUNDLE } from "../../tests/fixtures/session-bundle";
import { ExportError, ExportFileSchema, fromExport, toExport } from "./export-schema";

const now = new Date("2026-10-13T10:00:00.000Z");

function keys(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => keys(x, out));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      out.push(k);
      keys(x, out);
    }
  return out;
}

describe("toExport", () => {
  const file = toExport([SESSION_BUNDLE], now);
  it("validates and strips internals", () => {
    expect(ExportFileSchema.safeParse(file).success).toBe(true);
    const k = keys(file);
    for (const bad of ["html", "userId", "id", "deletedAt", "runId", "callId", "sessionId"])
      expect(k).not.toContain(bad);
    expect(file.sessions[0]?.calls[0]?.ref).toBe("r1-answer-claude");
    expect(file.sessions[0]?.calls.find((c) => c.kind === "review")?.claims.length).toBeGreaterThan(
      0,
    );
  });
});

describe("fromExport", () => {
  it("round-trips", () => {
    const { bundles, warnings } = fromExport(
      JSON.parse(JSON.stringify(toExport([SESSION_BUNDLE], now))),
    );
    expect(warnings).toEqual([]);
    const b = bundles[0]!;
    expect(b.session.question).toBe(SESSION_BUNDLE.session.question);
    expect(b.session.stats).toEqual(SESSION_BUNDLE.session.stats);
    expect(b.runs).toHaveLength(1);
    expect(b.calls).toHaveLength(4);
    expect(b.calls.flatMap((c) => c.claims.map((x) => x.claim)).sort()).toEqual(
      SESSION_BUNDLE.claims.map((x) => x.claim).sort(),
    );
    expect(b.calls[0]?.citations).toEqual(SESSION_BUNDLE.calls[0]?.citations);
  });

  it("rejects wrong version", () => {
    const bad = { ...toExport([SESSION_BUNDLE], now), v: 2 };
    expect(() => fromExport(bad)).toThrow(ExportError);
  });

  it("rejects non-objects", () => {
    expect(() => fromExport("x")).toThrow(ExportError);
  });

  it("truncates beyond 500 sessions", () => {
    const f = toExport([SESSION_BUNDLE], now);
    const big = { ...f, sessions: Array.from({ length: 501 }, () => f.sessions[0]) };
    const { bundles, warnings } = fromExport(big);
    expect(bundles).toHaveLength(500);
    expect(warnings).toContain("too_many_sessions");
  });

  it("keeps RTL/emoji question byte-identical", () => {
    const q = "هل التمدد الثابت يقلل الإصابات؟ 🏃‍♀️";
    const b = makeBundle({ session: { ...SESSION_BUNDLE.session, question: q } });
    const out = fromExport(JSON.parse(JSON.stringify(toExport([b], now)))).bundles[0]!;
    expect(out.session.question).toBe(q);
  });

  it("coerces running calls to failed/interrupted", () => {
    const b = makeBundle({
      calls: SESSION_BUNDLE.calls.map((c, i) =>
        i === 0 ? { ...c, status: "running" as const } : c,
      ),
    });
    const { bundles, warnings } = fromExport(toExport([b], now));
    expect(bundles[0]?.calls[0]).toMatchObject({ status: "failed", errorCode: "interrupted" });
    expect(warnings.length).toBe(1);
  });
});
