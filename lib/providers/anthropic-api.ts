import { anthropicErrorSchema, anthropicResponseSchema } from "./anthropic-schemas";
import type { AnthropicBlock, AnthropicMessage, AnthropicResponse } from "./anthropic-schemas";
import { ProviderError } from "./errors";
import { uniqueCitations } from "./types";
import type {
  CallOptions,
  Citation,
  ModelRequest,
  ModelResult,
  Provider,
  ProviderDeps,
  ProviderStatus,
  ReasoningEffort,
} from "./types";

export type { AnthropicBlock, AnthropicMessage } from "./anthropic-schemas";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
// Newer web_search tool versions add result filtering; bump here only.
export const WEB_SEARCH_TOOL = "web_search_20250305";
export const THINKING_MODELS: readonly string[] = ["claude-opus-5-5", "claude-sonnet-5-5"];
export const THINKING_BUDGET: Record<ReasoningEffort, number> = {
  low: 1024,
  medium: 4096,
  high: 16000,
  max: 32000,
};

const MAX_TOKENS = 8000;
const MAX_ROUNDS = 4;
const TEST_MODEL = "claude-haiku-5-5";
const TRUNCATED_NOTE = "\n\n[Answer truncated at the length limit.]";

export type AnthropicRequestBody = {
  model: string;
  max_tokens: number;
  system?: string;
  temperature?: number;
  messages: readonly AnthropicMessage[];
  tools?: readonly Record<string, unknown>[];
  thinking?: { type: "enabled"; budget_tokens: number };
};

/** Builds the Messages API body. With `thinking` enabled the API requires temperature 1, so it is omitted. */
export function buildAnthropicBody(
  req: ModelRequest,
  messages: readonly AnthropicMessage[],
): AnthropicRequestBody {
  const thinking = THINKING_MODELS.includes(req.model);
  return {
    model: req.model,
    max_tokens: MAX_TOKENS,
    system: req.system,
    ...(thinking
      ? { thinking: { type: "enabled", budget_tokens: THINKING_BUDGET[req.reasoningEffort] } }
      : { temperature: req.temperature }),
    messages,
    tools: [
      {
        type: WEB_SEARCH_TOOL,
        name: "web_search",
        max_uses: req.maxSearches,
        ...(req.preferredDomains.length ? { allowed_domains: [...req.preferredDomains] } : {}),
      },
    ],
  };
}

const countSearches = (blocks: readonly AnthropicBlock[]) =>
  blocks.filter((b) => b.type === "server_tool_use").length;

/** Extracts final answer text, unique citations and search count from accumulated content blocks. */
export function parseAnthropicContent(
  blocks: readonly AnthropicBlock[],
  stopReason: string | null,
) {
  const lastTool = blocks.findLastIndex((b) => b.type !== "text");
  const tail = blocks.slice(lastTool + 1).filter((b) => b.type === "text");
  const texts = tail.length ? tail : blocks.filter((b) => b.type === "text");
  const text = texts.map((b) => b.text ?? "").join("");
  const citations: Citation[] = blocks.flatMap((b) =>
    (b.citations ?? []).flatMap((c) => (c.url ? [{ title: c.title ?? c.url, url: c.url }] : [])),
  );
  const truncated = stopReason === "max_tokens";
  return {
    text: (text || "The model returned no text.") + (truncated ? TRUNCATED_NOTE : ""),
    citations: uniqueCitations(citations),
    searches: countSearches(blocks),
    truncated,
  };
}

const sumOrNull = (values: readonly (number | undefined)[]) => {
  const present = values.filter((v): v is number => v !== undefined);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

async function readError(res: Response): Promise<ProviderError> {
  const parsed = anthropicErrorSchema.safeParse(await res.json().catch(() => null));
  const message = (parsed.success && parsed.data.error?.message) || `HTTP ${res.status}`;
  if (res.status === 401 || res.status === 403) {
    return new ProviderError("no_credentials", `Anthropic API: ${message}`, { status: res.status });
  }
  return new ProviderError("provider_http", `Anthropic API: ${message}`, { status: res.status });
}

function mapFetchError(e: unknown, timeoutMs: number): ProviderError {
  if (e instanceof ProviderError) return e;
  const name = e instanceof Error ? e.name : "";
  if (name === "TimeoutError") {
    return new ProviderError(
      "timeout",
      `Anthropic API timed out after ${Math.round(timeoutMs / 1000)} s.`,
      { cause: e },
    );
  }
  if (name === "AbortError")
    return new ProviderError("aborted", "Anthropic API call aborted.", { cause: e });
  return new ProviderError("network", "Could not reach the Anthropic API.", { cause: e });
}

export function createAnthropicProvider(
  cfg: { apiKey?: string },
  deps: ProviderDeps = {},
): Provider {
  const doFetch = deps.fetch ?? fetch;

  async function post(body: AnthropicRequestBody, signal: AbortSignal, timeoutMs: number) {
    if (!cfg.apiKey)
      throw new ProviderError("no_credentials", "Anthropic API key is not configured.");
    let res: Response;
    try {
      res = await doFetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
    } catch (e) {
      throw mapFetchError(e, timeoutMs);
    }
    if (!res.ok) throw await readError(res);
    try {
      return anthropicResponseSchema.parse(await res.json());
    } catch (cause) {
      throw new ProviderError(
        "provider_bad_response",
        "Anthropic returned an unexpected response.",
        { cause },
      );
    }
  }

  return {
    id: "claude",
    transport: "anthropic-api",
    async call(req: ModelRequest, { signal, onProgress }: CallOptions): Promise<ModelResult> {
      if (!cfg.apiKey)
        throw new ProviderError("no_credentials", "Anthropic API key is not configured.");
      const started = performance.now();
      const messages: AnthropicMessage[] = [{ role: "user", content: req.user }];
      const content: AnthropicBlock[] = [];
      const rounds: AnthropicResponse[] = [];
      let seen = 0;
      for (let i = 0; i < MAX_ROUNDS; i++) {
        const data = await post(buildAnthropicBody(req, messages), signal, req.timeoutMs);
        rounds.push(data);
        content.push(...data.content);
        const searches = countSearches(content);
        if (searches > seen) onProgress?.({ phase: "searching", searches });
        seen = searches;
        if (data.stop_reason !== "pause_turn") break;
        messages.splice(1, messages.length, { role: "assistant", content: [...content] });
      }
      const last = rounds[rounds.length - 1];
      const parsed = parseAnthropicContent(content, last?.stop_reason ?? null);
      onProgress?.({ phase: "writing", searches: parsed.searches });
      return {
        text: parsed.text,
        citations: parsed.citations,
        model: last?.model ?? req.model,
        usage: {
          inputTokens: sumOrNull(rounds.map((r) => r.usage?.input_tokens)),
          outputTokens: sumOrNull(rounds.map((r) => r.usage?.output_tokens)),
          searches: parsed.searches,
        },
        durationMs: Math.round(performance.now() - started),
      };
    },
    async test(signal: AbortSignal): Promise<ProviderStatus> {
      const transport = "anthropic-api" as const;
      if (!cfg.apiKey) return { ok: false, transport, detail: "API key not configured" };
      try {
        await post(
          { model: TEST_MODEL, max_tokens: 1, messages: [{ role: "user", content: "ping" }] },
          signal,
          15_000,
        );
        return { ok: true, transport, detail: "Connected" };
      } catch (e) {
        return { ok: false, transport, detail: e instanceof Error ? e.message : "Unknown error" };
      }
    },
  };
}
