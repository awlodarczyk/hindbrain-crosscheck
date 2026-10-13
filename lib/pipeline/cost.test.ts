import { describe, expect, it } from "vitest";
import type { Settings } from "../settings/schema";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { estimateCost, estimateQuestionCost } from "./cost";

type Connection = Settings["providers"]["claude"]["connection"];

function withSettings(patch: {
  claude?: Partial<Settings["providers"]["claude"]>;
  chatgpt?: Partial<Settings["providers"]["chatgpt"]>;
  reasoningEffort?: Settings["reasoningEffort"];
  depth?: Settings["tuning"]["webSearchDepth"];
  connection?: Connection;
}): Settings {
  const d = DEFAULT_SETTINGS;
  const connection = patch.connection;
  return {
    ...d,
    reasoningEffort: patch.reasoningEffort ?? d.reasoningEffort,
    providers: {
      claude: {
        ...d.providers.claude,
        ...(connection ? { connection } : {}),
        ...patch.claude,
      },
      chatgpt: {
        ...d.providers.chatgpt,
        ...(connection ? { connection } : {}),
        ...patch.chatgpt,
      },
    },
    tuning: { ...d.tuning, webSearchDepth: patch.depth ?? d.tuning.webSearchDepth },
  };
}

describe("estimateCost", () => {
  const base = {
    model: "gpt-5.5",
    inputTokens: 1_000_000,
    outputTokens: 0,
    searches: 0,
    transport: "openai-api" as const,
  };

  it("prices input tokens per million", () => {
    expect(estimateCost(base)).toBe(10);
  });

  it("adds search cost per 1000 searches", () => {
    expect(estimateCost({ ...base, searches: 1000 })).toBe(35);
  });

  it("returns null for subscription and fake transports", () => {
    expect(estimateCost({ ...base, transport: "claude-cli" })).toBeNull();
    expect(estimateCost({ ...base, transport: "codex-cli" })).toBeNull();
    expect(estimateCost({ ...base, transport: "mock" })).toBeNull();
  });

  it("returns null for an unknown model", () => {
    expect(estimateCost({ ...base, model: "unknown-model" })).toBeNull();
  });

  it("treats null token counts as zero", () => {
    expect(estimateCost({ ...base, inputTokens: null, outputTokens: null, searches: 0 })).toBe(0);
  });

  it("rounds to 4 decimals at the end only", () => {
    const cost = estimateCost({
      model: "gpt-5.5-mini",
      inputTokens: 3,
      outputTokens: 7,
      searches: 1,
      transport: "openai-api",
    });
    // 3/1e6*2 + 7/1e6*8 + 1/1000*25 = 0.025062 -> 0.0251
    expect(cost).toBe(0.0251);
  });
});

describe("estimateQuestionCost", () => {
  it("returns a positive low < high range with 2-decimal values for defaults", () => {
    const { low, high } = estimateQuestionCost(DEFAULT_SETTINGS);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(Math.round(low * 100) / 100).toBe(low);
    expect(Math.round(high * 100) / 100).toBe(high);
  });

  it("is zero when both connections are cli", () => {
    const s = withSettings({ connection: "cli" });
    expect(estimateQuestionCost(s)).toEqual({ low: 0, high: 0 });
  });

  it("grows with reasoning effort", () => {
    const low = estimateQuestionCost(withSettings({ reasoningEffort: "low" }));
    const max = estimateQuestionCost(withSettings({ reasoningEffort: "max" }));
    expect(max.low).toBeGreaterThan(low.low);
    expect(max.high).toBeGreaterThan(low.high);
  });

  it("grows with search depth", () => {
    const quick = estimateQuestionCost(withSettings({ depth: "quick" }));
    const deep = estimateQuestionCost(withSettings({ depth: "deep" }));
    expect(deep.high).toBeGreaterThan(quick.high);
  });

  it("does not throw for an unknown answer model", () => {
    const s = withSettings({ claude: { answerModel: "mystery-model" } });
    const { low, high } = estimateQuestionCost(s);
    expect(low).toBeLessThanOrEqual(high);
  });
});
