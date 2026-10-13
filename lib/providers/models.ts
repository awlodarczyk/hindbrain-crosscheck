import type { ProviderId } from "../db/enums";

export type ModelInfo = {
  id: string;
  provider: ProviderId;
  label: string;
  /** USD per million input tokens. */
  inputPerM: number;
  /** USD per million output tokens. */
  outputPerM: number;
  /** USD per 1000 web searches. */
  searchPer1k: number;
  /** Model spends hidden reasoning tokens (OpenAI reasoning family). */
  reasoning: boolean;
  /** Model supports extended thinking (Anthropic). */
  thinking: boolean;
};

// approximate list prices, edit here
export const MODELS: readonly ModelInfo[] = [
  {
    id: "claude-opus-5-5",
    provider: "claude",
    label: "Claude Opus 5.5",
    inputPerM: 15,
    outputPerM: 75,
    searchPer1k: 10,
    reasoning: false,
    thinking: true,
  },
  {
    id: "claude-sonnet-5-5",
    provider: "claude",
    label: "Claude Sonnet 5.5",
    inputPerM: 3,
    outputPerM: 15,
    searchPer1k: 10,
    reasoning: false,
    thinking: true,
  },
  {
    id: "claude-haiku-5-5",
    provider: "claude",
    label: "Claude Haiku 5.5",
    inputPerM: 1,
    outputPerM: 5,
    searchPer1k: 10,
    reasoning: false,
    thinking: false,
  },
  {
    id: "gpt-5.5",
    provider: "chatgpt",
    label: "GPT-5.5",
    inputPerM: 10,
    outputPerM: 30,
    searchPer1k: 25,
    reasoning: true,
    thinking: false,
  },
  {
    id: "gpt-5.5-mini",
    provider: "chatgpt",
    label: "GPT-5.5 mini",
    inputPerM: 2,
    outputPerM: 8,
    searchPer1k: 25,
    reasoning: true,
    thinking: false,
  },
];

export function modelsFor(provider: ProviderId): readonly ModelInfo[] {
  return MODELS.filter((m) => m.provider === provider);
}

export function findModel(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

/** Returns the first catalogue entry for `provider`. Throws if the catalogue has none. */
export function defaultModelFor(provider: ProviderId): ModelInfo {
  const model = modelsFor(provider)[0];
  if (!model) throw new Error(`no catalogue model for provider ${provider}`);
  return model;
}
