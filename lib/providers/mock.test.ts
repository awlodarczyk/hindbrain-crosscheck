import { describe, expect, it } from "vitest";
import fixtures from "@/tests/fixtures/mock-answers.json";
import { ProviderError } from "./errors";
import { createMockProvider } from "./mock";
import type { ModelRequest, ProgressEvent } from "./types";

const req = (kind: "answer" | "review"): ModelRequest => ({
  kind,
  system: "s",
  user: "u",
  model: "m-1",
  maxSearches: 2,
  temperature: 0,
  reasoningEffort: "low",
  timeoutMs: 1000,
  preferredDomains: [],
});
const sig = () => new AbortController().signal;

describe("mock provider", () => {
  it("answers from fixtures with progress", async () => {
    const events: ProgressEvent[] = [];
    const r = await createMockProvider("claude").call(req("answer"), {
      signal: sig(),
      onProgress: (e) => events.push(e),
    });
    expect(r.text).toBe(fixtures.answers.claude.text);
    expect(r.citations.length).toBeGreaterThanOrEqual(2);
    expect(r.model).toBe("m-1");
    expect(r.usage).toEqual({ inputTokens: 1200, outputTokens: 600, searches: 2 });
    expect(events).toEqual([
      { phase: "searching", searches: 1 },
      { phase: "searching", searches: 2 },
      { phase: "writing", searches: 2 },
    ]);
  });

  it("serves the review fixture and respects delayMs", async () => {
    const r = await createMockProvider("chatgpt", { delayMs: 30 }).call(req("review"), {
      signal: sig(),
    });
    expect(r.text).toBe(fixtures.review.text);
    expect(r.durationMs).toBeGreaterThanOrEqual(25);
  });

  it("fails with failWith, optionally per kind", async () => {
    const err = new ProviderError("network", "down");
    await expect(
      createMockProvider("claude", { failWith: err }).call(req("answer"), { signal: sig() }),
    ).rejects.toBe(err);
    const p = createMockProvider("claude", { failWith: err, failFor: "review" });
    await expect(p.call(req("answer"), { signal: sig() })).resolves.toBeTruthy();
    await expect(p.call(req("review"), { signal: sig() })).rejects.toBe(err);
  });

  it("rejects aborted", async () => {
    const ac = new AbortController();
    const p = createMockProvider("claude", { delayMs: 500 }).call(req("answer"), {
      signal: ac.signal,
    });
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: "aborted" });
    const pre = new AbortController();
    pre.abort();
    await expect(
      createMockProvider("claude").call(req("answer"), { signal: pre.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("test() is ok", async () => {
    await expect(createMockProvider("claude").test(sig())).resolves.toEqual({
      ok: true,
      transport: "mock",
      detail: "mock provider",
    });
  });
});
