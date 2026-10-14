import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_STATS, type Session } from "@/lib/repos/types";
import { CreateSessionBody, ListQuery, RenameBody, toListItem } from "./sessions-dto";

describe("CreateSessionBody", () => {
  it("normalises an exported ChatGPT transcript to plain turns", () => {
    const transcript = readFileSync("tests/fixtures/transcripts/chatgpt-export.json", "utf8");
    expect(CreateSessionBody.parse({ mode: "transcript", transcript }).transcript).toBe(
      "User: Does stretching prevent injuries?\n\nAssistant: Not reliably.",
    );
  });
  it("still rejects an oversized plain transcript", () => {
    expect(
      CreateSessionBody.safeParse({ mode: "transcript", transcript: "x".repeat(200_001) }).success,
    ).toBe(false);
  });
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

describe("CreateSessionBody transcript mode", () => {
  it("needs a transcript and defaults the focus question", () => {
    expect(CreateSessionBody.safeParse({ mode: "transcript" }).success).toBe(false);
    expect(CreateSessionBody.safeParse({ mode: "transcript", transcript: "  " }).success).toBe(
      false,
    );
    expect(CreateSessionBody.parse({ mode: "transcript", transcript: " U: hi\nA: hey " })).toEqual({
      mode: "transcript",
      transcript: "U: hi\nA: hey",
      question: "Which claims in this conversation hold up?",
    });
    expect(
      CreateSessionBody.parse({ mode: "transcript", transcript: "x", question: "focus" }).question,
    ).toBe("focus");
  });
  it("rejects an oversized transcript", () => {
    const r = CreateSessionBody.safeParse({ mode: "transcript", transcript: "x".repeat(200_001) });
    expect(r.success).toBe(false);
  });
});

describe("ListQuery / RenameBody", () => {
  it("defaults and coerces", () => {
    expect(ListQuery.parse({})).toEqual({ limit: 50 });
    expect(ListQuery.parse({ limit: "10" }).limit).toBe(10);
    expect(ListQuery.safeParse({ limit: "101" }).success).toBe(false);
  });
  it("parses the compound before cursor", () => {
    expect(ListQuery.parse({ before: "2026-01-01T00:00:00.000Z|abc" }).before).toEqual({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "abc",
    });
    expect(ListQuery.safeParse({ before: "2026-01-01T00:00:00.000Z" }).success).toBe(false);
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
    transcript: null,
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
