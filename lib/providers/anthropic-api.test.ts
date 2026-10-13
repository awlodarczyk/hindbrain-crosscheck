import { describe, expect, it, vi } from "vitest";
import answerOk from "@/tests/fixtures/anthropic/answer-ok.json";
import pause1 from "@/tests/fixtures/anthropic/pause-turn-1.json";
import pause2 from "@/tests/fixtures/anthropic/pause-turn-2.json";
import maxTokens from "@/tests/fixtures/anthropic/max-tokens.json";
import error401 from "@/tests/fixtures/anthropic/error-401.json";
import { createAnthropicProvider } from "./anthropic-api";
import type { ModelRequest, ProgressEvent } from "./types";

const req: ModelRequest = {
  kind: "answer",
  system: "sys",
  user: "What is the boiling point of water?",
  model: "claude-haiku-5-5",
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
const bodyOf = (fn: ReturnType<typeof fakeFetch>, i: number) =>
  JSON.parse(String(fn.mock.calls[i]?.[1]?.body));
const run = (
  fetchFn: typeof fetch,
  r: ModelRequest = req,
  onProgress?: (e: ProgressEvent) => void,
) =>
  createAnthropicProvider({ apiKey: "sk-test" }, { fetch: fetchFn }).call(r, {
    signal: new AbortController().signal,
    onProgress,
  });

describe("anthropic provider", () => {
  it("parses a successful answer", async () => {
    const progress: ProgressEvent[] = [];
    const res = await run(fakeFetch(json(answerOk)), req, (e) => progress.push(e));
    expect(res.text).toBe("Water boils at about 100 C at sea level and lower at altitude.");
    expect(res.citations.map((c) => c.url)).toEqual([
      "https://example.org/boiling",
      "https://example.org/altitude",
    ]);
    expect(res.usage).toEqual({ inputTokens: 2100, outputTokens: 640, searches: 1 });
    expect(res.model).toBe("claude-opus-5-5");
    expect(progress).toEqual([
      { phase: "searching", searches: 1 },
      { phase: "writing", searches: 1 },
    ]);
  });

  it("continues pause_turn rounds with valid role alternation", async () => {
    const f = fakeFetch(json(pause1), json(pause2), json(answerOk));
    const res = await run(f);
    expect(f).toHaveBeenCalledTimes(3);
    const msgs = bodyOf(f, 2).messages;
    expect(msgs.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[1].content).toHaveLength(pause1.content.length + pause2.content.length);
    expect(res.usage.searches).toBe(3);
    expect(res.usage.inputTokens).toBe(2300);
  });

  it("appends a note when truncated", async () => {
    const res = await run(fakeFetch(json(maxTokens)));
    expect(res.text).toBe(
      "A very long answer that was cut\n\n[Answer truncated at the length limit.]",
    );
  });

  it("maps 401 to no_credentials", async () => {
    await expect(run(fakeFetch(json(error401, 401)))).rejects.toMatchObject({
      code: "no_credentials",
    });
  });

  it("maps 500 to provider_http with the API message", async () => {
    const body = { type: "error", error: { type: "api_error", message: "overloaded" } };
    await expect(run(fakeFetch(json(body, 500)))).rejects.toMatchObject({
      code: "provider_http",
      status: 500,
      message: expect.stringContaining("overloaded"),
    });
  });

  it("rejects a malformed body", async () => {
    await expect(run(fakeFetch(json({})))).rejects.toMatchObject({ code: "provider_bad_response" });
  });

  it("sends allowed_domains when preferred domains are set", async () => {
    const f = fakeFetch(json(answerOk));
    await run(f, { ...req, preferredDomains: ["example.org"] });
    expect(bodyOf(f, 0).tools[0]).toMatchObject({ allowed_domains: ["example.org"], max_uses: 3 });
  });

  it("enables thinking and omits temperature for thinking models", async () => {
    const f = fakeFetch(json(answerOk));
    await run(f, { ...req, model: "claude-opus-5-5", reasoningEffort: "high" });
    const body = bodyOf(f, 0);
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 16000 });
    expect(body).not.toHaveProperty("temperature");
  });

  it("omits thinking and keeps temperature for haiku", async () => {
    const f = fakeFetch(json(answerOk));
    await run(f);
    const body = bodyOf(f, 0);
    expect(body).not.toHaveProperty("thinking");
    expect(body.temperature).toBe(0.3);
    expect(f.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it("fails without a key and never fetches", async () => {
    const f = fakeFetch();
    const p = createAnthropicProvider({}, { fetch: f });
    await expect(p.call(req, { signal: new AbortController().signal })).rejects.toMatchObject({
      code: "no_credentials",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("maps a caller abort to aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const f = vi.fn<typeof fetch>((_u, init) =>
      init?.signal?.aborted
        ? Promise.reject(new DOMException("x", "AbortError"))
        : Promise.resolve(json(answerOk)),
    );
    const p = createAnthropicProvider({ apiKey: "k" }, { fetch: f });
    await expect(p.call(req, { signal: ctrl.signal })).rejects.toMatchObject({ code: "aborted" });
    expect(f.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it("maps TimeoutError to timeout", async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("x", "TimeoutError"));
    await expect(run(f)).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps other fetch errors to network", async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(run(f)).rejects.toMatchObject({ code: "network" });
  });

  it("test() reports missing key and connection", async () => {
    const signal = new AbortController().signal;
    expect(await createAnthropicProvider({}).test(signal)).toEqual({
      ok: false,
      transport: "anthropic-api",
      detail: "API key not configured",
    });
    const ok = await createAnthropicProvider(
      { apiKey: "k" },
      { fetch: fakeFetch(json(answerOk)) },
    ).test(signal);
    expect(ok).toMatchObject({ ok: true, detail: "Connected" });
    const bad = await createAnthropicProvider(
      { apiKey: "k" },
      { fetch: fakeFetch(json(error401, 401)) },
    ).test(signal);
    expect(bad.ok).toBe(false);
  });

  it("keeps thinking budget below max_tokens for every effort", async () => {
    for (const reasoningEffort of ["low", "medium", "high", "max"] as const) {
      const f = fakeFetch(json(answerOk));
      await run(f, { ...req, model: "claude-opus-5-5", reasoningEffort });
      const body = bodyOf(f, 0);
      expect(body.thinking.budget_tokens).toBeLessThan(body.max_tokens);
    }
    const f = fakeFetch(json(answerOk));
    await run(f);
    expect(bodyOf(f, 0).max_tokens).toBe(8000);
  });

  it("maps a timeout during body read to timeout", async () => {
    const res = {
      ok: true,
      status: 200,
      json: () => Promise.reject(new DOMException("x", "TimeoutError")),
    };
    const f = vi.fn<typeof fetch>().mockResolvedValue(res as unknown as Response);
    await expect(run(f)).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps a custom abort reason to aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort(new Error("custom"));
    const f = vi.fn<typeof fetch>().mockRejectedValue(new Error("custom"));
    const p = createAnthropicProvider({ apiKey: "k" }, { fetch: f });
    await expect(p.call(req, { signal: ctrl.signal })).rejects.toMatchObject({ code: "aborted" });
  });

  it("flags truncation after four consecutive pause_turn rounds", async () => {
    const f = fakeFetch(json(pause1), json(pause2), json(pause1), json(pause2));
    const res = await run(f);
    expect(f).toHaveBeenCalledTimes(4);
    expect(res.text).toContain("[Answer truncated at the length limit.]");
  });

  it("shares one deadline across rounds", async () => {
    let clock = 0;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const f = vi.fn<typeof fetch>(() => {
      clock += 600;
      return Promise.resolve(json(pause1));
    });
    await run(f, { ...req, timeoutMs: 1000 });
    expect(timeout.mock.calls.map((c) => c[0])).toEqual([1000, 400, 1, 1]);
    vi.restoreAllMocks();
  });
});
