/*
 * Observed CLI contract (claude 2.1.296, spiked on macOS):
 * - Flags: -p, --output-format json, --model, --append-system-prompt, --max-turns,
 *   --allowedTools / --disallowedTools all exist.
 * - With -p and no argument the prompt is read from stdin.
 * - stdout is one JSON object: { type:"result", subtype:"success", is_error, result,
 *   num_turns, duration_ms, session_id, total_cost_usd, usage:{input_tokens, output_tokens, ...},
 *   modelUsage, ... }.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { detectCli } from "./cli-detect";
import { runCli } from "./cli-runner";
import { ProviderError } from "./errors";
import { extractUrls } from "./cli-citations";
import type {
  CallOptions,
  ModelRequest,
  ModelResult,
  Provider,
  ProviderDeps,
  ProviderStatus,
} from "./types";

const TEST_MODEL = "claude-haiku-5-5";
const TEST_TIMEOUT_MS = 60_000;
const MAX_TURNS = "6";
const ALLOWED_TOOLS = "WebSearch,WebFetch";
const DISALLOWED_TOOLS = "Bash,Edit,Write,MultiEdit,NotebookEdit";

const outputSchema = z.object({
  is_error: z.boolean().optional(),
  result: z.string(),
  num_turns: z.number().nullish(),
  duration_ms: z.number().nullish(),
  total_cost_usd: z.number().nullish(),
  usage: z
    .object({ input_tokens: z.number().nullish(), output_tokens: z.number().nullish() })
    .optional(),
});

export const CLAUDE_ARGS = (req: ModelRequest): readonly string[] => [
  "-p",
  "--output-format",
  "json",
  "--model",
  req.model,
  "--append-system-prompt",
  req.system,
  "--max-turns",
  MAX_TURNS,
  "--allowedTools",
  ALLOWED_TOOLS,
  "--disallowedTools",
  DISALLOWED_TOOLS,
];

export function parseClaudeCliOutput(stdout: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout);
  } catch (cause) {
    throw new ProviderError("provider_bad_response", "claude returned non-JSON output.", { cause });
  }
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderError("provider_bad_response", "claude returned an unexpected JSON shape.", {
      cause: parsed.error,
    });
  }
  const d = parsed.data;
  if (d.is_error) throw new ProviderError("cli_failed", d.result);
  return {
    text: d.result,
    usage: {
      inputTokens: d.usage?.input_tokens ?? null,
      outputTokens: d.usage?.output_tokens ?? null,
    },
    costUsd: d.total_cost_usd ?? null,
    meta: {
      numTurns: d.num_turns ?? null,
      durationMs: d.duration_ms ?? null,
      costUsd: d.total_cost_usd ?? null,
    },
  };
}

const withDomains = (req: ModelRequest) =>
  req.preferredDomains.length
    ? `${req.user}\n\nPrefer sources from: ${req.preferredDomains.join(", ")}.`
    : req.user;

export function createClaudeCliProvider(
  cfg: { cliPath?: string },
  deps: ProviderDeps & { mkdtemp?: () => string } = {},
): Provider {
  const mkdtemp = deps.mkdtemp ?? (() => mkdtempSync(join(tmpdir(), "claude-")));

  const run = async (
    req: ModelRequest,
    signal: AbortSignal,
    cmd: string,
    onLine?: (l: string) => void,
  ) => {
    let dir: string | undefined;
    try {
      dir = mkdtemp();
      return await runCli(cmd, CLAUDE_ARGS(req), {
        input: withDomains(req),
        timeoutMs: req.timeoutMs,
        signal,
        spawn: deps.spawn,
        onStderrLine: onLine,
        cwd: dir,
      });
    } finally {
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  };

  return {
    id: "claude",
    transport: "claude-cli",
    async call(req: ModelRequest, opts: CallOptions): Promise<ModelResult> {
      let searches = 0;
      const res = await run(req, opts.signal, cfg.cliPath ?? "claude", (line) => {
        if (/search/i.test(line)) opts.onProgress?.({ phase: "searching", searches: ++searches });
      });
      const out = parseClaudeCliOutput(res.stdout);
      opts.onProgress?.({ phase: "writing", searches });
      return {
        text: out.text,
        citations: extractUrls(out.text),
        model: req.model,
        usage: { ...out.usage, searches },
        durationMs: res.durationMs,
        raw: out.meta,
      };
    },
    async test(signal: AbortSignal): Promise<ProviderStatus> {
      const info = await detectCli("claude", { spawn: deps.spawn, path: cfg.cliPath });
      if (!info.found) {
        return {
          ok: false,
          transport: "claude-cli",
          detail: info.detail ?? "claude was not found.",
        };
      }
      const req: ModelRequest = {
        kind: "answer",
        system: "Answer in one word.",
        user: "Reply with pong",
        model: TEST_MODEL,
        maxSearches: 0,
        temperature: 0,
        reasoningEffort: "low",
        timeoutMs: TEST_TIMEOUT_MS,
        preferredDomains: [],
      };
      try {
        parseClaudeCliOutput((await run(req, signal, cfg.cliPath ?? info.path ?? "claude")).stdout);
      } catch (e) {
        return {
          ok: false,
          transport: "claude-cli",
          detail: e instanceof Error ? e.message : String(e),
        };
      }
      return {
        ok: true,
        transport: "claude-cli",
        detail: "Connected",
        version: info.version,
        path: info.path,
      };
    },
  };
}
