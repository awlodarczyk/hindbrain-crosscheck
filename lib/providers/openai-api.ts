import { ProviderError } from "./errors";
import { openAIErrorSchema, openAIResponseSchema } from "./openai-schemas";
import type { OpenAIResponse } from "./openai-schemas";
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

export type { OpenAIResponse } from "./openai-schemas";

export const OPENAI_URL = "https://api.openai.com/v1/responses";
export const REASONING_MODELS: readonly string[] = ["gpt-5.5", "gpt-5.5-mini"];

const MAX_OUTPUT_TOKENS = 8000;
const TEST_MODEL = "gpt-5.5-mini";
const TEST_TIMEOUT_MS = 15_000;
const TRUNCATED_NOTE = "\n\n[Answer truncated at the length limit.]";

export type OpenAIRequestBody = {
  model: string;
  instructions?: string;
  input: string;
  temperature?: number;
  max_output_tokens: number;
  tools?: readonly Record<string, unknown>[];
  reasoning?: { effort: "low" | "medium" | "high" };
};

export function effortFor(effort: ReasoningEffort): "low" | "medium" | "high" {
  return effort === "max" ? "high" : effort;
}

/** Builds the Responses API body. Reasoning models reject `temperature`, so it is omitted for them. */
export function buildOpenAIBody(req: ModelRequest): OpenAIRequestBody {
  const reasoning = REASONING_MODELS.includes(req.model);
  return {
    model: req.model,
    instructions: req.system,
    input: req.user,
    ...(reasoning
      ? { reasoning: { effort: effortFor(req.reasoningEffort) } }
      : { temperature: req.temperature }),
    tools: [
      {
        type: "web_search",
        ...(req.preferredDomains.length
          ? { filters: { allowed_domains: [...req.preferredDomains] } }
          : {}),
      },
    ],
    max_output_tokens: MAX_OUTPUT_TOKENS,
  };
}

/** Extracts answer text, unique citations and web search count from a validated response. */
export function parseOpenAIOutput(data: OpenAIResponse) {
  const parts = data.output
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text");
  const text = data.output_text || parts.map((p) => p.text ?? "").join("\n");
  const citations: Citation[] = parts.flatMap((p) =>
    (p.annotations ?? []).flatMap((a) =>
      a.type === "url_citation" && a.url ? [{ title: a.title ?? a.url, url: a.url }] : [],
    ),
  );
  return {
    text,
    citations: uniqueCitations(citations),
    searches: data.output.filter((item) => item.type === "web_search_call").length,
  };
}

async function readError(
  res: Response,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<ProviderError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch (e) {
    if (isAbortLike(e, signal)) return mapFetchError(e, signal, timeoutMs);
  }
  const parsed = openAIErrorSchema.safeParse(body);
  const message = (parsed.success && parsed.data.error?.message) || `HTTP ${res.status}`;
  const code = res.status === 401 || res.status === 403 ? "no_credentials" : "provider_http";
  return new ProviderError(code, `OpenAI API: ${message}`, { status: res.status });
}

const isAbortLike = (e: unknown, signal: AbortSignal) =>
  signal.aborted || (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"));

function mapFetchError(e: unknown, signal: AbortSignal, timeoutMs: number): ProviderError {
  if (signal.aborted) return new ProviderError("aborted", "OpenAI API call aborted.", { cause: e });
  const name = e instanceof Error ? e.name : "";
  if (name === "TimeoutError") {
    return new ProviderError(
      "timeout",
      `OpenAI API timed out after ${Math.round(timeoutMs / 1000)} s.`,
      { cause: e },
    );
  }
  if (name === "AbortError")
    return new ProviderError("aborted", "OpenAI API call aborted.", { cause: e });
  return new ProviderError("network", "Could not reach the OpenAI API.", { cause: e });
}

export function createOpenAIProvider(cfg: { apiKey?: string }, deps: ProviderDeps = {}): Provider {
  const doFetch = deps.fetch ?? fetch;
  const noKey = () => new ProviderError("no_credentials", "OpenAI API key is not configured.");

  async function post(body: OpenAIRequestBody, signal: AbortSignal, timeoutMs: number) {
    if (!cfg.apiKey) throw noKey();
    let res: Response;
    try {
      res = await doFetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
    } catch (e) {
      throw mapFetchError(e, signal, timeoutMs);
    }
    if (!res.ok) throw await readError(res, signal, timeoutMs);
    try {
      return openAIResponseSchema.parse(await res.json());
    } catch (cause) {
      if (isAbortLike(cause, signal)) throw mapFetchError(cause, signal, timeoutMs);
      throw new ProviderError("provider_bad_response", "OpenAI returned an unexpected response.", {
        cause,
      });
    }
  }

  return {
    id: "chatgpt",
    transport: "openai-api",
    async call(req: ModelRequest, { signal, onProgress }: CallOptions): Promise<ModelResult> {
      if (!cfg.apiKey) throw noKey();
      const started = performance.now();
      const data = await post(buildOpenAIBody(req), signal, req.timeoutMs);
      const parsed = parseOpenAIOutput(data);
      if (!parsed.text) {
        throw new ProviderError("provider_bad_response", "The model returned no text.");
      }
      // Single-shot API: progress is reported once the whole response has arrived.
      if (parsed.searches > 0) onProgress?.({ phase: "searching", searches: parsed.searches });
      onProgress?.({ phase: "writing", searches: parsed.searches });
      return {
        text: parsed.text + (data.status === "incomplete" ? TRUNCATED_NOTE : ""),
        citations: parsed.citations,
        model: data.model,
        usage: {
          inputTokens: data.usage?.input_tokens ?? null,
          outputTokens: data.usage?.output_tokens ?? null,
          searches: parsed.searches,
        },
        durationMs: Math.round(performance.now() - started),
      };
    },
    async test(signal: AbortSignal): Promise<ProviderStatus> {
      const transport = "openai-api" as const;
      if (!cfg.apiKey) return { ok: false, transport, detail: "API key not configured" };
      try {
        await post(
          { model: TEST_MODEL, input: "ping", max_output_tokens: 16 },
          signal,
          TEST_TIMEOUT_MS,
        );
        return { ok: true, transport, detail: "Connected" };
      } catch (e) {
        return { ok: false, transport, detail: e instanceof Error ? e.message : "Unknown error" };
      }
    },
  };
}
