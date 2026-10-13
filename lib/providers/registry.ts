import type { Env } from "@/lib/env";
import type { ProviderId, Transport } from "@/lib/db/enums";
import type { Settings } from "@/lib/settings/schema";
import { TRANSPORT_FACTORIES } from "./transports";
import type { Provider, ProviderConfig, ProviderDeps } from "./types";

export type TransportEnv = Pick<
  Env,
  "PROVIDER_TRANSPORT" | "CLI_ENABLED" | "APP_MODE" | "ANTHROPIC_API_KEY" | "OPENAI_API_KEY"
>;

const TABLE: Record<ProviderId, Record<"cli" | "api", Transport>> = {
  claude: { cli: "claude-cli", api: "anthropic-api" },
  chatgpt: { cli: "codex-cli", api: "openai-api" },
};

export function transportFor(id: ProviderId, connection: "cli" | "api"): Transport {
  return TABLE[id][connection];
}

export function createProvider(cfg: ProviderConfig, deps: ProviderDeps = {}): Provider {
  return TRANSPORT_FACTORIES[cfg.transport](cfg, deps);
}

function resolveOne(
  id: ProviderId,
  connection: "cli" | "api",
  envKey: string | undefined,
  secret: string | null,
  cliEnabled: boolean,
): ProviderConfig {
  if (connection === "cli" && cliEnabled) return { id, transport: transportFor(id, "cli") };
  const apiKey = envKey ?? secret ?? undefined;
  const fallbackReason = connection === "cli" ? "cli_disabled" : undefined;
  return {
    id,
    transport: transportFor(id, "api"),
    apiKey,
    ...(fallbackReason && { fallbackReason }),
  };
}

/** Maps settings, stored secrets and env to one transport config per provider. */
export function resolveProviderConfigs(
  settings: Settings,
  secrets: { claude: string | null; chatgpt: string | null },
  env: TransportEnv,
): Record<ProviderId, ProviderConfig> {
  if (env.PROVIDER_TRANSPORT === "mock") {
    return {
      claude: { id: "claude", transport: "mock" },
      chatgpt: { id: "chatgpt", transport: "mock" },
    };
  }
  const cliEnabled = env.CLI_ENABLED === "1";
  return {
    claude: resolveOne(
      "claude",
      settings.providers.claude.connection,
      env.ANTHROPIC_API_KEY,
      secrets.claude,
      cliEnabled,
    ),
    chatgpt: resolveOne(
      "chatgpt",
      settings.providers.chatgpt.connection,
      env.OPENAI_API_KEY,
      secrets.chatgpt,
      cliEnabled,
    ),
  };
}
