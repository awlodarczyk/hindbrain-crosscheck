import { describe, expect, it } from "vitest";
import { createAnthropicProvider } from "@/lib/providers/anthropic-api";

// Live test exception: reads process.env directly; run manually with RUN_LIVE=1 and ANTHROPIC_API_KEY set.
describe.skipIf(!process.env.RUN_LIVE || !process.env.ANTHROPIC_API_KEY)("anthropic live", () => {
  it("answers a short question", async () => {
    const provider = createAnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await provider.call(
      {
        kind: "answer",
        system: "Answer in one sentence.",
        user: "What is the capital of Poland?",
        model: "claude-haiku-5-5",
        maxSearches: 1,
        temperature: 0.2,
        reasoningEffort: "low",
        timeoutMs: 60_000,
        preferredDomains: [],
      },
      { signal: new AbortController().signal },
    );
    expect(res.text.length).toBeGreaterThan(0);
  });
});
