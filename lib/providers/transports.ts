import type { Transport } from "@/lib/db/enums";
import type { ProviderId } from "@/lib/db/enums";
import { ProviderError } from "./errors";
import { createMockProvider } from "./mock";
import type { Provider, ProviderConfig, ProviderDeps } from "./types";

export type ProviderFactory = (cfg: ProviderConfig, deps: ProviderDeps) => Provider;

/** Placeholder for transports that have no implementation yet. */
export function notImplemented(transport: Transport, id: ProviderId): Provider {
  const message = `${transport} transport is not implemented yet`;
  return {
    id,
    transport,
    call: () => Promise.reject(new ProviderError("provider_bad_response", message)),
    test: async () => ({ ok: false, transport, detail: message }),
  };
}

const stub: ProviderFactory = (cfg) => notImplemented(cfg.transport, cfg.id);

export const TRANSPORT_FACTORIES: Record<Transport, ProviderFactory> = {
  mock: (cfg) => createMockProvider(cfg.id),
  "anthropic-api": stub,
  "openai-api": stub,
  "claude-cli": stub,
  "codex-cli": stub,
};
