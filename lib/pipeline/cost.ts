import type { ProviderId, Transport } from "../db/enums";
import { defaultModelFor, findModel, type ModelInfo } from "../providers/models";
import type { Settings } from "../settings/schema";

export type CostInput = {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  searches: number;
  transport: Transport;
};

const METERED: ReadonlySet<Transport> = new Set<Transport>(["anthropic-api", "openai-api"]);

/** Token and search counts assumed per call, by answer style. */
export const STYLE_TOKENS: Record<
  Settings["tuning"]["answerStyle"],
  { input: number; output: number }
> = {
  concise: { input: 800, output: 400 },
  balanced: { input: 1500, output: 900 },
  thorough: { input: 2500, output: 1800 },
};

/** Multiplier on the search budget, by web search depth. */
export const DEPTH_FACTOR: Record<Settings["tuning"]["webSearchDepth"], number> = {
  quick: 0.5,
  standard: 1,
  deep: 1.5,
};

/** A review call reads the answer plus instructions. */
export const REVIEW_TOKENS = { input: 2200, output: 700 };

const EFFORT_MULTIPLIER: Record<Settings["reasoningEffort"], number> = {
  low: 1,
  medium: 1.3,
  high: 1.8,
  max: 2.5,
};

/**
 * Estimated USD cost of one provider call.
 *
 * @returns null for subscription (CLI) or fake transports, and for unknown models.
 */
export function estimateCost(input: CostInput): number | null {
  if (!METERED.has(input.transport)) return null;
  const model = findModel(input.model);
  if (!model) return null;
  const raw =
    ((input.inputTokens ?? 0) / 1e6) * model.inputPerM +
    ((input.outputTokens ?? 0) / 1e6) * model.outputPerM +
    (input.searches / 1000) * model.searchPer1k;
  return Math.round(raw * 1e4) / 1e4;
}

type CallSpec = {
  provider: ProviderId;
  model: string;
  review: boolean;
};

function specsFor(settings: Settings): CallSpec[] {
  const { claude, chatgpt } = settings.providers;
  const claudeReview = chatgpt.verificationModel ?? chatgpt.answerModel;
  const chatgptReview = claude.verificationModel ?? claude.answerModel;
  return [
    { provider: "claude", model: claude.answerModel, review: false },
    { provider: "chatgpt", model: chatgpt.answerModel, review: false },
    { provider: "chatgpt", model: claudeReview, review: true },
    { provider: "claude", model: chatgptReview, review: true },
  ];
}

function resolveModel(provider: ProviderId, id: string): ModelInfo {
  return findModel(id) ?? defaultModelFor(provider);
}

function callCost(
  settings: Settings,
  spec: CallSpec,
  searches: number,
  outputFactor: number,
): number {
  const connection = settings.providers[spec.provider].connection;
  if (connection === "cli") return 0;
  const model = resolveModel(spec.provider, spec.model);
  const tokens = spec.review ? REVIEW_TOKENS : STYLE_TOKENS[settings.tuning.answerStyle];
  const effort =
    model.reasoning || model.thinking ? EFFORT_MULTIPLIER[settings.reasoningEffort] : 1;
  const cost = estimateCost({
    model: model.id,
    inputTokens: tokens.input,
    outputTokens: tokens.output * effort * outputFactor,
    searches,
    transport: spec.provider === "claude" ? "anthropic-api" : "openai-api",
  });
  return cost ?? 0;
}

/**
 * Estimated USD range for one question: two answers and two cross-check reviews.
 * CLI connections contribute nothing. Values are rounded to 2 decimals, low <= high.
 */
export function estimateQuestionCost(settings: Settings): { low: number; high: number } {
  const budget = Math.min(settings.tuning.webSearchMax, settings.cost.maxSearchesPerCall);
  const searches = budget * DEPTH_FACTOR[settings.tuning.webSearchDepth];
  const specs = specsFor(settings);
  const sum = (searchFactor: number, outputFactor: number) =>
    specs.reduce(
      (acc, spec) => acc + callCost(settings, spec, searches * searchFactor, outputFactor),
      0,
    );
  // low: half the searches, 0.7x output; high: full searches, 1.3x output
  const low = Math.round(sum(0.5, 0.7) * 100) / 100;
  const high = Math.round(sum(1, 1.3) * 100) / 100;
  return { low, high: Math.max(low, high) };
}
