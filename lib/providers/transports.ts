import type { Transport } from "@/lib/db/enums";
import { createAnthropicProvider } from "./anthropic-api";
import { createClaudeCliProvider } from "./claude-cli";
import { createCodexCliProvider } from "./codex-cli";
import { createMockProvider } from "./mock";
import { createOpenAIProvider } from "./openai-api";
import type { Provider, ProviderConfig, ProviderDeps } from "./types";

export type ProviderFactory = (cfg: ProviderConfig, deps: ProviderDeps) => Provider;

export const TRANSPORT_FACTORIES: Record<Transport, ProviderFactory> = {
  mock: (cfg) => createMockProvider(cfg.id),
  "anthropic-api": (cfg, deps) => createAnthropicProvider({ apiKey: cfg.apiKey }, deps),
  "openai-api": (cfg, deps) => createOpenAIProvider({ apiKey: cfg.apiKey }, deps),
  "claude-cli": (cfg, deps) => createClaudeCliProvider({ cliPath: cfg.cliPath }, deps),
  "codex-cli": (cfg, deps) => createCodexCliProvider({ cliPath: cfg.cliPath }, deps),
};
