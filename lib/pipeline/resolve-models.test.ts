import { describe, expect, it } from "vitest";
import { defaultModelFor } from "@/lib/providers/models";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { SettingsSchema } from "@/lib/settings/schema";
import { resolveModels } from "./resolve-models";

const api = { claude: "anthropic-api", chatgpt: "openai-api" } as const;

describe("resolveModels", () => {
  it("uses settings defaults; null verification falls back to answer", () => {
    expect(resolveModels(DEFAULT_SETTINGS, api)).toEqual({
      claude: { answer: "claude-opus-5-5", verification: "claude-opus-5-5" },
      chatgpt: { answer: "gpt-5.5", verification: "gpt-5.5-mini" },
    });
  });

  it("forces verification = answer for codex-cli", () => {
    const m = resolveModels(DEFAULT_SETTINGS, { claude: "claude-cli", chatgpt: "codex-cli" });
    expect(m.chatgpt).toEqual({ answer: "gpt-5.5", verification: "gpt-5.5" });
  });

  it("falls back to the catalogue default when answerModel is empty", () => {
    const s = SettingsSchema.parse({ providers: { claude: { answerModel: "" } } });
    const m = resolveModels(s, api);
    expect(m.claude.answer).toBe(defaultModelFor("claude").id);
    expect(m.claude.verification).toBe(defaultModelFor("claude").id);
  });
});
