import type { ProviderId, Transport } from "@/lib/db/enums";

export type ReasoningEffort = "low" | "medium" | "high" | "max";
export type ProgressEvent = { phase: "searching" | "writing"; searches: number };

export type ModelRequest = {
  kind: "answer" | "review";
  system: string;
  user: string;
  model: string;
  maxSearches: number;
  temperature: number;
  reasoningEffort: ReasoningEffort;
  timeoutMs: number;
  preferredDomains: readonly string[];
};

export type Citation = { title: string; url: string };

export type ModelResult = {
  text: string;
  citations: readonly Citation[];
  model: string;
  usage: { inputTokens: number | null; outputTokens: number | null; searches: number };
  durationMs: number;
  raw?: unknown;
};

export type ProviderStatus = {
  ok: boolean;
  transport: Transport;
  detail: string;
  version?: string;
  account?: string;
  path?: string;
};

export type CallOptions = { signal: AbortSignal; onProgress?: (e: ProgressEvent) => void };

export interface Provider {
  readonly id: ProviderId;
  readonly transport: Transport;
  call(req: ModelRequest, opts: CallOptions): Promise<ModelResult>;
  test(signal: AbortSignal): Promise<ProviderStatus>;
}

export type ProviderConfig = {
  id: ProviderId;
  transport: Transport;
  apiKey?: string;
  cliPath?: string;
  fallbackReason?: string;
};

export type SpawnFn = typeof import("node:child_process").spawn;
export type ProviderDeps = { fetch?: typeof fetch; spawn?: SpawnFn };

/** Drops repeated urls, keeping the first occurrence. */
export function uniqueCitations(items: readonly Citation[]): readonly Citation[] {
  const seen = new Set<string>();
  return items.filter((c) => !seen.has(c.url) && seen.add(c.url));
}
