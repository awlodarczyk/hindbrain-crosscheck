import { describe, expect, it, vi } from "vitest";
import answerOk from "@/tests/fixtures/openai/answer-ok.json";
import noText from "@/tests/fixtures/openai/no-text.json";
import error429 from "@/tests/fixtures/openai/error-429.json";
import { ProviderError } from "./errors";
import { buildOpenAIBody, createOpenAIProvider, effortFor, OPENAI_URL } from "./openai-api";
import type { ModelRequest, ProgressEvent } from "./types";

const KEY = "sk-secret-key";
const req: ModelRequest = {
  kind: "answer",
  system: "sys",
  user: "What is the boiling point of water?",
  model: "gpt-4.1",
  maxSearches: 3,
  temperature: 0.3,
  reasoningEffort: "medium",
  timeoutMs: 5000,
  preferredDomains: [],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fakeFetch = (...responses: Response[]) => {
  const fn = vi.fn<typeof fetch>();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  return fn;
};
const bodyOf = (fn: ReturnType<typeof fakeFetch>) =>
  JSON.parse(String(fn.mock.calls[0]?.[1]?.body));
const run = (
  fetchFn: typeof fetch,
  r: ModelRequest = req,
  onProgress?: (e: ProgressEvent) => void,
  signal: AbortSignal = new AbortController().signal,
  apiKey: string | null = KEY,
) =>
  createOpenAIProvider({ apiKey: apiKey ?? undefined }, { fetch: fetchFn }).call(r, {
    signal,
    onProgress,
  });
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as ProviderError;
  }
  throw new Error("expected rejection");
};

describe("openai provider", () => {
  it("parses a successful answer", async () => {
    const progress: ProgressEvent[] = [];
    const res = await run(fakeFetch(json(answerOk)), req, (e) => progress.push(e));
    expect(res.text).toBe("Water boils at about 100 C at sea level and lower at altitude.");
    expect(res.citations.map((c) => c.url)).toEqual([
      "https://example.org/boiling",
      "https://example.org/altitude",
    ]);
    expect(res.usage).toEqual({ inputTokens: 1800, outputTokens: 520, searches: 1 });
    expect(res.model).toBe("gpt-5.5");
    expect(progress).toEqual([
      { phase: "searching", searches: 1 },
      { phase: "writing", searches: 1 },
    ]);
  });

  it("joins output_text parts when top-level output_text is absent", async () => {
    const res = await run(fakeFetch(json({ ...answerOk, output_text: undefined })));
    expect(res.text).toBe("Water boils at about 100 C at sea level and lower at altitude.");
  });

  it("rejects an empty answer", async () => {
    const e = await failure(run(fakeFetch(json(noText))));
    expect(e.code).toBe("provider_bad_response");
  });

  it("maps 429 to provider_http with the API message", async () => {
    const e = await failure(run(fakeFetch(json(error429, 429))));
    expect(e.code).toBe("provider_http");
    expect(e.status).toBe(429);
    expect(e.message).toContain("Rate limit reached");
  });

  it("maps 401 to no_credentials", async () => {
    const e = await failure(run(fakeFetch(json(error429, 401))));
    expect(e.code).toBe("no_credentials");
    expect(e.message).not.toContain(KEY);
  });

  it("rejects a malformed body", async () => {
    const e = await failure(run(fakeFetch(json({ nope: true }))));
    expect(e.code).toBe("provider_bad_response");
  });

  it("sends bearer auth and the url", async () => {
    const f = fakeFetch(json(answerOk));
    await run(f);
    expect(f.mock.calls[0]?.[0]).toBe(OPENAI_URL);
    const headers = f.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
    expect(headers["content-type"]).toBe("application/json");
  });

  it("restricts search to preferred domains", async () => {
    const f = fakeFetch(json(answerOk));
    await run(f, { ...req, preferredDomains: ["who.int"] });
    expect(bodyOf(f).tools[0]).toEqual({
      type: "web_search",
      filters: { allowed_domains: ["who.int"] },
    });
  });

  it("uses reasoning.effort and no temperature on reasoning models", () => {
    const body = buildOpenAIBody({ ...req, model: "gpt-5.5", reasoningEffort: "max" });
    expect(body.reasoning).toEqual({ effort: "high" });
    expect(body).not.toHaveProperty("temperature");
    expect(body.max_output_tokens).toBe(8000);
    expect(effortFor("low")).toBe("low");
  });

  it("uses temperature and no reasoning on other models", () => {
    const body = buildOpenAIBody(req);
    expect(body.temperature).toBe(0.3);
    expect(body).not.toHaveProperty("reasoning");
  });

  it("does not fetch without a key", async () => {
    const f = fakeFetch();
    const e = await failure(run(f, req, undefined, undefined, null));
    expect(e.code).toBe("no_credentials");
    expect(f).not.toHaveBeenCalled();
  });

  it("maps a pre-aborted signal to aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const f = vi.fn<typeof fetch>().mockImplementation(async (_u, init) => {
      init?.signal?.throwIfAborted();
      return json(answerOk);
    });
    const e = await failure(run(f, req, undefined, ac.signal));
    expect(e.code).toBe("aborted");
  });

  it("maps TimeoutError to timeout", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const e = await failure(run(f));
    expect(e.code).toBe("timeout");
    expect(e.message).not.toContain(KEY);
  });

  it("maps other fetch failures to network", async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValue(new TypeError(`fail ${KEY}`));
    const e = await failure(run(f));
    expect(e.code).toBe("network");
    expect(e.message).not.toContain(KEY);
  });
});

describe("openai provider test()", () => {
  const signal = new AbortController().signal;
  it("reports missing key", async () => {
    const s = await createOpenAIProvider({}).test(signal);
    expect(s).toEqual({ ok: false, transport: "openai-api", detail: "API key not configured" });
  });
  it("pings without tools", async () => {
    const f = fakeFetch(json(answerOk));
    const s = await createOpenAIProvider({ apiKey: KEY }, { fetch: f }).test(signal);
    expect(s).toMatchObject({ ok: true, detail: "Connected" });
    expect(bodyOf(f)).toEqual({ model: "gpt-5.5-mini", input: "ping", max_output_tokens: 16 });
  });
  it("reports mapped errors", async () => {
    const f = fakeFetch(json(error429, 429));
    const s = await createOpenAIProvider({ apiKey: KEY }, { fetch: f }).test(signal);
    expect(s.ok).toBe(false);
    expect(s.detail).toContain("Rate limit reached");
  });
});
