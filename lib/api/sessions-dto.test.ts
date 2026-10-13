import { describe, expect, it } from "vitest";
import { EMPTY_STATS, type Session } from "@/lib/repos/types";
import { CreateSessionBody, ListQuery, RenameBody, toListItem } from "./sessions-dto";

describe("CreateSessionBody", () => {
  it("trims and defaults mode", () => {
    expect(CreateSessionBody.parse({ question: "  hi  " })).toMatchObject({
      question: "hi",
      mode: "ask",
    });
  });
  it("rejects empty and oversized questions", () => {
    expect(CreateSessionBody.safeParse({ question: "   " }).success).toBe(false);
    expect(CreateSessionBody.safeParse({ question: "x".repeat(8001) }).success).toBe(false);
  });
  it("requires pasted text in paste mode", () => {
    const r = CreateSessionBody.safeParse({
      question: "q",
      mode: "paste",
      pasted: { claude: " " },
    });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.path).toEqual(["pasted"]);
    expect(
      CreateSessionBody.safeParse({ question: "q", mode: "paste", pasted: { chatgpt: "a" } })
        .success,
    ).toBe(true);
  });
});

describe("ListQuery / RenameBody", () => {
  it("defaults and coerces", () => {
    expect(ListQuery.parse({})).toEqual({ limit: 50 });
    expect(ListQuery.parse({ limit: "10" }).limit).toBe(10);
    expect(ListQuery.safeParse({ limit: "101" }).success).toBe(false);
  });
  it("trims title", () => {
    expect(RenameBody.parse({ title: " a " }).title).toBe("a");
  });
});

describe("toListItem", () => {
  const base: Session = {
    id: "s",
    userId: "u",
    question: "Q",
    title: null,
    mode: "ask",
    status: "done",
    settingsSnapshot: null,
    stats: { ...EMPTY_STATS, claims: 8, disputed: 2, calls: 4, callsDone: 3 },
    createdAt: "t",
    updatedAt: "t",
    deletedAt: null,
  };
  it("maps stats and prefers title", () => {
    expect(toListItem(base)).toEqual({
      id: "s",
      question: "Q",
      status: "done",
      claims: 8,
      disputed: 2,
      callsDone: 3,
      callsTotal: 4,
      createdAt: "t",
    });
    expect(toListItem({ ...base, title: "T" }).question).toBe("T");
  });
});
