import { describe, expect, it } from "vitest";
import { makeSession } from "@/components/session/fixtures";
import { toHistoryItem } from "./history-item";

describe("toHistoryItem", () => {
  it("maps stats and prefers the title", () => {
    const item = toHistoryItem(makeSession({ title: "T", status: "done" }));
    expect(item).toMatchObject({ id: "s1", question: "T", status: "done", callsTotal: 0 });
  });
  it("assumes four planned calls for a live session without stats", () => {
    expect(toHistoryItem(makeSession({ status: "running" })).callsTotal).toBe(4);
  });
});
