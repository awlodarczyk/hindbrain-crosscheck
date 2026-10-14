import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatTurns,
  normalizeTranscript,
  parseChatGptExport,
  parseClaudeExport,
} from "./normalize";

const fixture = (name: string) => readFileSync(`tests/fixtures/transcripts/${name}.json`, "utf8");

const EXPECTED = "User: Does stretching prevent injuries?\n\nAssistant: Not reliably.";

describe("normalizeTranscript", () => {
  it("flattens a ChatGPT export along current_node, dropping system, tool and abandoned branches", () => {
    expect(normalizeTranscript(fixture("chatgpt-export"))).toEqual({
      format: "chatgpt",
      text: EXPECTED,
    });
  });
  it("flattens a Claude export and falls back to content[] when text is empty", () => {
    expect(normalizeTranscript(fixture("claude-export"))).toEqual({
      format: "claude",
      text: EXPECTED,
    });
  });
  it("accepts a single conversation object instead of an array", () => {
    const [one] = JSON.parse(fixture("claude-export")) as unknown[];
    expect(normalizeTranscript(JSON.stringify(one)).format).toBe("claude");
    const [gpt] = JSON.parse(fixture("chatgpt-export")) as unknown[];
    expect(normalizeTranscript(JSON.stringify(gpt)).format).toBe("chatgpt");
  });
  it("picks the deepest leaf when current_node is missing", () => {
    const [gpt] = JSON.parse(fixture("chatgpt-export")) as Record<string, unknown>[];
    const out = normalizeTranscript(JSON.stringify({ ...gpt, current_node: null }));
    expect(out).toEqual({ format: "chatgpt", text: EXPECTED });
  });
  it("never resolves prototype members as nodes", () => {
    const [gpt] = JSON.parse(fixture("chatgpt-export")) as Record<string, unknown>[];
    for (const current_node of ["constructor", "toString"]) {
      const raw = JSON.stringify({ ...gpt, current_node });
      expect(normalizeTranscript(raw).text).toBe(EXPECTED);
    }
    const orphan = { mapping: { a: { parent: "constructor", children: [] } }, current_node: "a" };
    const raw = JSON.stringify(orphan);
    expect(normalizeTranscript(raw)).toEqual({ format: "plain", text: raw });
  });
  it("terminates on a parent cycle", () => {
    const user = (parent: string) => ({
      parent,
      children: [],
      message: { author: { role: "user" }, content: { content_type: "text", parts: ["hi"] } },
    });
    const raw = JSON.stringify({ mapping: { a: user("b"), b: user("a") }, current_node: "a" });
    expect(normalizeTranscript(raw).text).toBe("User: hi\n\nUser: hi");
  });
  it("uses the first conversation of several", () => {
    const [first] = JSON.parse(fixture("claude-export")) as unknown[];
    const second = { chat_messages: [{ sender: "human", text: "other" }] };
    expect(normalizeTranscript(JSON.stringify([first, second])).text).toBe(EXPECTED);
  });
  it("treats an empty chat_messages array and missing parents as plain or safe", () => {
    const empty = JSON.stringify([{ chat_messages: [] }]);
    expect(normalizeTranscript(empty).format).toBe("plain");
    const dangling = JSON.stringify({
      mapping: { a: { parent: "missing", children: [], message: null } },
      current_node: "a",
    });
    expect(normalizeTranscript(dangling).format).toBe("plain");
  });
  it("returns plain text untouched", () => {
    const raw = "User: hi\nAssistant: hello";
    expect(normalizeTranscript(raw)).toEqual({ format: "plain", text: raw });
  });
  it("returns text that does not start with a JSON bracket as plain", () => {
    const raw = '  Assistant: {"chat_messages":[]}';
    expect(normalizeTranscript(raw)).toEqual({ format: "plain", text: raw });
  });
  it("treats JSON of unknown shape, empty mapping and invalid JSON as plain", () => {
    for (const raw of ['{"a":1}', "[1,2]", '[{"mapping":{}}]', '{"chat_messages":[]}', "{oops"]) {
      expect(normalizeTranscript(raw)).toEqual({ format: "plain", text: raw });
    }
  });
});

describe("parsers and formatTurns", () => {
  it("return null for non-matching input", () => {
    expect(parseChatGptExport(null)).toBeNull();
    expect(parseClaudeExport("x")).toBeNull();
  });
  it("formatTurns separates turns by a blank line", () => {
    expect(
      formatTurns([
        { role: "user", text: "a" },
        { role: "assistant", text: "b" },
      ]),
    ).toBe("User: a\n\nAssistant: b");
  });
});
