export type SessionStatus = "queued" | "running" | "done" | "partial" | "failed";
export type SessionMode = "ask" | "paste" | "transcript";
export type RunReason = "initial" | "manual" | "disagreement";
export type RunStatus = "queued" | "running" | "done" | "partial" | "failed";
export type CallKind = "answer" | "review";
export type CallStatus = "queued" | "running" | "done" | "failed" | "skipped";
export type Verdict = "supported" | "disputed" | "partial" | "unverifiable";
export type ProviderId = "claude" | "chatgpt";
export type Transport = "anthropic-api" | "openai-api" | "claude-cli" | "codex-cli" | "mock";

export const VERDICTS: readonly Verdict[] = ["supported", "disputed", "partial", "unverifiable"];
export const PROVIDER_IDS: readonly ProviderId[] = ["claude", "chatgpt"];
export const TRANSPORTS: readonly Transport[] = [
  "anthropic-api",
  "openai-api",
  "claude-cli",
  "codex-cli",
  "mock",
];
