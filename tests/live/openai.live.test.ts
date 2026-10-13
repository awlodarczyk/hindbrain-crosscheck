import { describe, expect, it } from "vitest";
import { createOpenAIProvider } from "@/lib/providers/openai-api";

// Live test exception: reads process.env directly; run manually with RUN_LIVE=1 and OPENAI_API_KEY set.
describe.skipIf(!process.env.RUN_LIVE || !process.env.OPENAI_API_KEY)("openai live", () => {
  it("answers a short question", async () => {
    const provider = createOpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
    const res = await provider.call(
      {
        kind: "answer",
        system: "Answer in one sentence.",
        user: "What is the capital of Poland?",
        model: "gpt-5.5-mini",
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
