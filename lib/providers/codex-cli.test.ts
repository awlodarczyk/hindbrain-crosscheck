import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeSpawn } from "@/tests/helpers/fake-spawn";
import { clearCliCache } from "./cli-detect";
import { CODEX_ARGS, createCodexCliProvider, parseCodexCliOutput } from "./codex-cli";
import type { ModelRequest } from "./types";

const fixture = readFileSync("tests/fixtures/cli/codex-json-ok.txt", "utf8");
const req: ModelRequest = {
  kind: "answer",
  system: "sys",
  user: "question",
  model: "gpt-5.5",
  maxSearches: 3,
  temperature: 0,
  reasoningEffort: "low",
  timeoutMs: 5000,
  preferredDomains: [],
};
const signal = new AbortController().signal;
const msg = (text: string) =>
  JSON.stringify({ type: "item.completed", item: { type: "agent_message", text } });

beforeEach(() => clearCliCache());

describe("parseCodexCliOutput", () => {
  it("parses the recorded fixture", () => {
    const p = parseCodexCliOutput(fixture);
    expect(p.text).toBe("pong");
    expect(p.usage).toEqual({ inputTokens: 26625, outputTokens: 39 });
  });
  it("takes the last message and ignores garbage lines", () => {
    const p = parseCodexCliOutput(`garbage\n${msg("first")}\n{oops\n${msg("last")}\n`);
    expect(p.text).toBe("last");
    expect(p.usage).toEqual({ inputTokens: null, outputTokens: null });
  });
  it("throws cli_failed on an error event", () => {
    expect(() => parseCodexCliOutput('{"type":"error","message":"boom"}')).toThrowError(
      expect.objectContaining({ code: "cli_failed", message: "boom" }),
    );
  });
  it("throws provider_bad_response without a message", () => {
    expect(() => parseCodexCliOutput('{"type":"turn.started"}')).toThrowError(
      expect.objectContaining({
        code: "provider_bad_response",
        message: "Codex returned no message.",
      }),
    );
  });
});

describe("parseCodexCliOutput tolerance", () => {
  it("keeps the message when a non-fatal error event precedes it", () => {
    const p = parseCodexCliOutput(`{"type":"error","message":"warn"}\n${msg("fine")}`);
    expect(p.text).toBe("fine");
  });
  it("fails on turn.failed even with a message", () => {
    expect(() =>
      parseCodexCliOutput(`${msg("x")}\n{"type":"turn.failed","error":{"message":"dead"}}`),
    ).toThrowError(expect.objectContaining({ code: "cli_failed", message: "dead" }));
  });
});

describe("CODEX_ARGS", () => {
  it("is read-only, json, and runs in the workdir with stdin prompt", () => {
    const a = CODEX_ARGS(req, "/w").join(" ");
    expect(a).toContain("exec --json");
    expect(a).toContain("--model gpt-5.5");
    expect(a).toContain("--sandbox read-only");
    expect(a).toContain("-C /w");
    expect(a.endsWith(" -")).toBe(true);
  });
});

describe("createCodexCliProvider", () => {
  const handler =
    (stdout: string, stderr = "") =>
    (cmd: string) =>
      cmd === "which" ? { stdout: "/bin/codex\n" } : { stdout, stderr };

  it("maps output, citations, progress; removes the temp dir", async () => {
    const dir = join(tmpdir(), `codex-test-${process.pid}-${Date.now()}`);
    const mkdtemp = () => (mkdirSync(dir), dir);
    const spawn = fakeSpawn(
      handler(`${msg("Read https://a.com/x.")}\n`, "web_search\nweb_search\n"),
    );
    const events: unknown[] = [];
    const p = createCodexCliProvider({}, { spawn, mkdtemp });
    const r = await p.call(
      { ...req, preferredDomains: ["a.com"] },
      { signal, onProgress: (e) => events.push(e) },
    );
    expect(r.text).toBe("Read https://a.com/x.");
    expect(r.citations).toEqual([{ title: "a.com", url: "https://a.com/x" }]);
    expect(r.usage.searches).toBe(2);
    expect(spawn.children.at(-1)?.stdinData).toBe("sys\n\nquestion\n\nPrefer sources from: a.com.");
    expect(spawn.calls.at(-1)?.args).toContain(dir);
    expect(events.at(-1)).toEqual({ phase: "writing", searches: 2 });
    expect(existsSync(dir)).toBe(false);
  });

  it("removes the temp dir when the call fails", async () => {
    const dir = join(tmpdir(), `codex-test-fail-${process.pid}-${Date.now()}`);
    const mkdtemp = () => (mkdirSync(dir), dir);
    const p = createCodexCliProvider(
      { cliPath: "/bin/codex" },
      { spawn: fakeSpawn({ stdout: '{"type":"error","message":"x"}' }), mkdtemp },
    );
    await expect(p.call(req, { signal })).rejects.toMatchObject({ code: "cli_failed" });
    expect(existsSync(dir)).toBe(false);
  });

  it("maps ENOENT to cli_not_found", async () => {
    const p = createCodexCliProvider({ cliPath: "codex" }, { spawn: fakeSpawn({ enoent: true }) });
    await expect(p.call(req, { signal })).rejects.toMatchObject({ code: "cli_not_found" });
  });

  it("test() reports not installed / connects", async () => {
    const miss = createCodexCliProvider({}, { spawn: fakeSpawn({ code: 1 }) });
    expect(await miss.test(signal)).toMatchObject({ ok: false, transport: "codex-cli" });
    clearCliCache();
    const ok = createCodexCliProvider({}, { spawn: fakeSpawn(handler(fixture)) });
    expect(await ok.test(signal)).toMatchObject({
      ok: true,
      detail: "Connected",
      path: "/bin/codex",
    });
  });

  it("uses the stdout error message when the process exits non-zero", async () => {
    const out =
      '{"type":"error","message":"model unsupported"}\n{"type":"turn.failed","error":{"message":"model unsupported"}}';
    const p = createCodexCliProvider(
      { cliPath: "/bin/codex" },
      { spawn: fakeSpawn({ stdout: out, stderr: "noise", code: 1 }) },
    );
    await expect(p.call(req, { signal })).rejects.toMatchObject({
      code: "cli_failed",
      message: "model unsupported",
    });
  });

  it("falls back to the runner error when stdout has no error event", async () => {
    const p = createCodexCliProvider(
      { cliPath: "/bin/codex" },
      { spawn: fakeSpawn({ stderr: "bad flag", code: 2 }) },
    );
    await expect(p.call(req, { signal })).rejects.toMatchObject({
      code: "cli_failed",
      message: expect.stringContaining("bad flag"),
    });
  });

  it("test() probes cfg.cliPath instead of which", async () => {
    const spawn = fakeSpawn((_cmd, args) => ({
      stdout: args[0] === "--version" ? "codex-cli 1\n" : fixture,
    }));
    const p = createCodexCliProvider({ cliPath: "/opt/codex" }, { spawn });
    expect(await p.test(signal)).toMatchObject({
      ok: true,
      path: "/opt/codex",
      version: "codex-cli 1",
    });
    expect(spawn.calls.some((c) => c.cmd === "which")).toBe(false);
  });

  it("does not expose thread ids in raw", async () => {
    const p = createCodexCliProvider(
      { cliPath: "/bin/codex" },
      { spawn: fakeSpawn({ stdout: fixture }) },
    );
    const r = await p.call(req, { signal });
    expect(JSON.stringify(r.raw)).not.toContain("thread");
  });
});
