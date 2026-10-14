import { describe, expect, it } from "vitest";
import { splitTurns } from "./turns";

describe("splitTurns", () => {
  it("splits labelled turns and strips labels", () => {
    expect(splitTurns("User: Hi\n\nAssistant: Hello")).toEqual([
      { role: "user", text: "Hi" },
      { role: "assistant", text: "Hello" },
    ]);
  });
  it("is case-insensitive and tolerates leading whitespace", () => {
    expect(splitTurns("  USER :  a\nassistant: b")).toEqual([
      { role: "user", text: "a" },
      { role: "assistant", text: "b" },
    ]);
  });
  it("keeps multi-line bodies", () => {
    expect(splitTurns("User: line1\nline2\n\nline3\nAssistant: ok")).toEqual([
      { role: "user", text: "line1\nline2\n\nline3" },
      { role: "assistant", text: "ok" },
    ]);
  });
  it("maps Human to user and AI to assistant", () => {
    expect(splitTurns("Human: q\nAI: a")).toEqual([
      { role: "user", text: "q" },
      { role: "assistant", text: "a" },
    ]);
  });
  it("turns leading unlabeled text into an other turn", () => {
    expect(splitTurns("preamble\nUser: q")).toEqual([
      { role: "other", text: "preamble" },
      { role: "user", text: "q" },
    ]);
  });
  it("returns one other turn when there are no labels", () => {
    expect(splitTurns("just text")).toEqual([{ role: "other", text: "just text" }]);
  });
  it("drops empty turns", () => {
    expect(splitTurns("User:\nAssistant: a\nUser:   ")).toEqual([{ role: "assistant", text: "a" }]);
    expect(splitTurns("  \n")).toEqual([]);
  });
});
