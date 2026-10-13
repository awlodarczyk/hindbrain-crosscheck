import { describe, expect, it } from "vitest";
import { groupByDay, rowMeta, type HistoryItem } from "./group-by-day";

const base: HistoryItem = {
  id: "x",
  question: "q",
  status: "done",
  claims: 11,
  disputed: 3,
  callsDone: 0,
  callsTotal: 4,
  createdAt: "",
};
const item = (id: string, d: Date): HistoryItem => ({ ...base, id, createdAt: d.toISOString() });
const ago = (now: Date, h: number) => new Date(now.getTime() - h * 3_600_000);

describe("groupByDay", () => {
  const now = new Date(2026, 5, 15, 12);
  it("groups in fixed order", () => {
    const items = [
      item("a", ago(now, 1)),
      item("b", ago(now, 26)),
      item("c", ago(now, 5 * 24)),
      item("d", ago(now, 20 * 24)),
    ];
    const g = groupByDay(items, now);
    expect(g.map((x) => x.label)).toEqual(["Today", "Yesterday", "Last 7 days", "Older"]);
    expect(g.map((x) => x.items.map((i) => i.id))).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });
  it("returns [] for empty and omits empty groups", () => {
    expect(groupByDay([], now)).toEqual([]);
    expect(groupByDay([item("a", ago(now, 1))], now).map((x) => x.label)).toEqual(["Today"]);
  });
  it("uses local day boundaries near midnight", () => {
    const n = new Date(2026, 5, 15, 0, 30);
    const g = groupByDay([item("a", new Date(2026, 5, 14, 23, 50))], n);
    expect(g[0]?.label).toBe("Yesterday");
  });
  it("keeps input order and does not mutate", () => {
    const items = [item("a", ago(now, 1)), item("b", ago(now, 2))];
    const copy = [...items];
    expect(groupByDay(items, now)[0]?.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(items).toEqual(copy);
  });
});

describe("rowMeta", () => {
  const fmt = () => "14:32";
  it("formats done", () => expect(rowMeta(base, fmt)).toBe("11 claims · 3 disputed · 14:32"));
  it("formats running", () =>
    expect(rowMeta({ ...base, status: "running", callsDone: 2 }, fmt)).toBe(
      "checking · 2 of 4 calls",
    ));
  it("formats failed", () =>
    expect(rowMeta({ ...base, status: "failed" }, fmt)).toBe("failed · 14:32"));
});
