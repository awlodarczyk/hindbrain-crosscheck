import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSpawn } from "@/tests/helpers/fake-spawn";
import { extractUrls } from "./cli-citations";
import { clearCliCache } from "./cli-detect";
import { CLAUDE_ARGS, createClaudeCliProvider, parseClaudeCliOutput } from "./claude-cli";
import type { ModelRequest } from "./types";

const fixture = readFileSync("tests/fixtures/cli/claude-json-ok.txt", "utf8");
const req: ModelRequest = {
  kind: "answer",
  system: "sys",
  user: "question",
  model: "claude-haiku-5-5",
  maxSearches: 3,
  temperature: 0,
  reasoningEffort: "low",
  timeoutMs: 5000,
  preferredDomains: [],
};
const signal = new AbortController().signal;
const result = (text: string) =>
  JSON.stringify({
    type: "result",
    is_error: false,
    result: text,
    total_cost_usd: 0.1,
    usage: { input_tokens: 3, output_tokens: 4 },
  });

beforeEach(() => clearCliCache());

describe("parseClaudeCliOutput", () => {
  it("parses the recorded fixture", () => {
    const p = parseClaudeCliOutput(fixture);
    expect(p.text).toBe("pong");
    expect(p.usage.outputTokens).toBe(138);
    expect(p.costUsd).toBeGreaterThan(0);
  });
  it("throws cli_failed on is_error", () => {
    expect(() => parseClaudeCliOutput('{"type":"result","is_error":true,"result":"boom"}')).toThrow(
      /boom/,
    );
  });
  it("throws provider_bad_response on malformed or unknown shape", () => {
    for (const bad of ["not json", '{"foo":1}']) {
      expect(() => parseClaudeCliOutput(bad)).toThrowError(
        expect.objectContaining({ code: "provider_bad_response" }),
      );
    }
  });
});

describe("extractUrls", () => {
  it("finds unique urls and strips trailing punctuation", () => {
    const c = extractUrls("See https://a.com/x), and https://a.com/x. also (https://b.org/y).");
    expect(c).toEqual([
      { title: "a.com", url: "https://a.com/x" },
      { title: "b.org", url: "https://b.org/y" },
    ]);
  });
});

describe("CLAUDE_ARGS", () => {
  it("contains json output and model", () => {
    const a = CLAUDE_ARGS(req).join(" ");
    expect(a).toContain("--output-format json");
    expect(a).toContain("--model claude-haiku-5-5");
  });
});

describe("createClaudeCliProvider", () => {
  const handler =
    (stdout: string, stderr = "") =>
    (cmd: string) =>
      cmd === "which" ? { stdout: "/bin/claude\n" } : { stdout, stderr };

  it("maps output, citations, and sends the prompt on stdin", async () => {
    const spawn = fakeSpawn(
      handler(result("Read https://a.com/x."), "Searching the web…\nSearching the web…\n"),
    );
    const events: unknown[] = [];
    const p = createClaudeCliProvider({}, { spawn });
    const r = await p.call(
      { ...req, preferredDomains: ["a.com", "b.org"] },
      { signal, onProgress: (e) => events.push(e) },
    );
    expect(r.text).toBe("Read https://a.com/x.");
    expect(r.citations).toEqual([{ title: "a.com", url: "https://a.com/x" }]);
    expect(r.usage).toEqual({ inputTokens: 3, outputTokens: 4, searches: 2 });
    expect(r.model).toBe("claude-haiku-5-5");
    expect(spawn.children.at(-1)?.stdinData).toBe("question\n\nPrefer sources from: a.com, b.org.");
    expect(events).toEqual([
      { phase: "searching", searches: 1 },
      { phase: "searching", searches: 2 },
      { phase: "writing", searches: 2 },
    ]);
  });

  it("test() reports not installed", async () => {
    const p = createClaudeCliProvider({}, { spawn: fakeSpawn({ code: 1 }) });
    expect(await p.test(signal)).toMatchObject({ ok: false, transport: "claude-cli" });
  });

  it("test() connects", async () => {
    const p = createClaudeCliProvider(
      {},
      {
        spawn: fakeSpawn((cmd) =>
          cmd === "which" ? { stdout: "/bin/claude\n" } : { stdout: result("pong") },
        ),
      },
    );
    expect(await p.test(signal)).toMatchObject({
      ok: true,
      detail: "Connected",
      path: "/bin/claude",
    });
  });

  it("propagates cli_failed from is_error", async () => {
    const p = createClaudeCliProvider(
      { cliPath: "/bin/claude" },
      { spawn: fakeSpawn({ stdout: '{"type":"result","is_error":true,"result":"x"}' }) },
    );
    await expect(p.call(req, { signal })).rejects.toMatchObject({ code: "cli_failed" });
    vi.restoreAllMocks();
  });
});
