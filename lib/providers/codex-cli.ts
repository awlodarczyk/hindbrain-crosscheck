/*
 * Observed CLI contract (codex-cli 0.158.0, spiked on macOS):
 * - `codex exec --json --model <m> --sandbox read-only --skip-git-repo-check -C <dir> -`
 *   reads the prompt from stdin when the prompt argument is `-`. No system-prompt flag exists.
 * - stdout is JSONL: thread.started, turn.started,
 *   {"type":"item.completed","item":{"type":"agent_message","text":"..."}},
 *   {"type":"turn.completed","usage":{input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens}}.
 * - Failures emit {"type":"error","message"} then {"type":"turn.failed","error":{"message"}};
 *   non-fatal notices arrive as item.completed with item.type "error" (ignored).
 * - Models unsupported by the ChatGPT account fail with a 400 error event.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { extractUrls } from "./cli-citations";
import { detectCli } from "./cli-detect";
import { runCli } from "./cli-runner";
import { ProviderError } from "./errors";
import type {
  CallOptions,
  ModelRequest,
  ModelResult,
  Provider,
  ProviderDeps,
  ProviderStatus,
} from "./types";

const TEST_MODEL = "gpt-5.5";
const TEST_TIMEOUT_MS = 60_000;

const eventSchema = z.object({
  type: z.string(),
  message: z.string().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
  item: z.object({ type: z.string(), text: z.string().optional() }).optional(),
  usage: z
    .object({ input_tokens: z.number().nullish(), output_tokens: z.number().nullish() })
    .optional(),
});

export const CODEX_ARGS = (req: ModelRequest, workdir: string): readonly string[] => [
  "exec",
  "--json",
  "--model",
  req.model,
  "--sandbox",
  "read-only",
  "--skip-git-repo-check",
  "-C",
  workdir,
  "-",
];

function parseEvents(stdout: string) {
  return stdout.split("\n").flatMap((line) => {
    try {
      const p = eventSchema.safeParse(JSON.parse(line));
      return p.success ? [p.data] : [];
    } catch {
      return [];
    }
  });
}

type CodexEvent = ReturnType<typeof parseEvents>[number];

const turnFailure = (events: readonly CodexEvent[]) => events.find((e) => e.type === "turn.failed");
const errorEvent = (events: readonly CodexEvent[]) => events.find((e) => e.type === "error");

/** Best failure message found in stdout events, if any. */
function failureMessage(stdout: string): string | undefined {
  const events = parseEvents(stdout);
  return turnFailure(events)?.error?.message ?? errorEvent(events)?.message;
}

export function parseCodexCliOutput(stdout: string) {
  const events = parseEvents(stdout);
  const failed = turnFailure(events);
  if (failed) throw new ProviderError("cli_failed", failed.error?.message ?? "Codex turn failed.");
  const text = events
    .flatMap((e) =>
      e.type === "item.completed" && e.item?.type === "agent_message" && e.item.text !== undefined
        ? [e.item.text]
        : [],
    )
    .at(-1);
  if (text === undefined) {
    const err = errorEvent(events);
    if (err) throw new ProviderError("cli_failed", err.message ?? "Codex reported an error.");
    throw new ProviderError("provider_bad_response", "Codex returned no message.");
  }
  const usage = events.findLast((e) => e.type === "turn.completed")?.usage;
  return {
    text,
    usage: { inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null },
  };
}

const buildPrompt = (req: ModelRequest) => {
  const user = req.preferredDomains.length
    ? `${req.user}\n\nPrefer sources from: ${req.preferredDomains.join(", ")}.`
    : req.user;
  return `${req.system}\n\n${user}`;
};

export function createCodexCliProvider(
  cfg: { cliPath?: string },
  deps: ProviderDeps & { mkdtemp?: () => string } = {},
): Provider {
  const mkdtemp = deps.mkdtemp ?? (() => mkdtempSync(join(tmpdir(), "codex-")));

  const run = async (
    req: ModelRequest,
    signal: AbortSignal,
    cmd: string,
    onLine?: (l: string) => void,
  ) => {
    let dir: string | undefined;
    try {
      dir = mkdtemp();
      return await runCli(cmd, CODEX_ARGS(req, dir), {
        input: buildPrompt(req),
        timeoutMs: req.timeoutMs,
        signal,
        spawn: deps.spawn,
        onStderrLine: onLine,
      });
    } catch (e) {
      if (!(e instanceof ProviderError)) {
        throw new ProviderError("cli_failed", `codex failed to start: ${String(e)}`, { cause: e });
      }
      const message = e.code === "cli_failed" ? failureMessage(e.stdout ?? "") : undefined;
      throw message ? new ProviderError("cli_failed", message, { cause: e }) : e;
    } finally {
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  };

  return {
    id: "chatgpt",
    transport: "codex-cli",
    async call(req: ModelRequest, opts: CallOptions): Promise<ModelResult> {
      let searches = 0;
      const res = await run(req, opts.signal, cfg.cliPath ?? "codex", (line) => {
        if (/search/i.test(line)) opts.onProgress?.({ phase: "searching", searches: ++searches });
      });
      const out = parseCodexCliOutput(res.stdout);
      opts.onProgress?.({ phase: "writing", searches });
      return {
        text: out.text,
        citations: extractUrls(out.text),
        model: req.model,
        usage: { ...out.usage, searches },
        durationMs: res.durationMs,
        raw: { durationMs: res.durationMs, usage: out.usage },
      };
    },
    async test(signal: AbortSignal): Promise<ProviderStatus> {
      const info = await detectCli("codex", { spawn: deps.spawn, path: cfg.cliPath });
      if (!info.found) {
        return {
          ok: false,
          transport: "codex-cli",
          detail: info.detail ?? "codex was not found.",
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
        parseCodexCliOutput((await run(req, signal, cfg.cliPath ?? info.path ?? "codex")).stdout);
      } catch (e) {
        return {
          ok: false,
          transport: "codex-cli",
          detail: e instanceof Error ? e.message : String(e),
        };
      }
      return {
        ok: true,
        transport: "codex-cli",
        detail: "Connected",
        version: info.version,
        path: info.path,
      };
    },
  };
}
