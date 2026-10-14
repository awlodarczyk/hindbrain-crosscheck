import type {
  CallKind,
  CallStatus,
  ProviderId,
  RunReason,
  RunStatus,
  SessionMode,
  SessionStatus,
  Transport,
  Verdict,
} from "@/lib/db/enums";

export type SessionStats = {
  claims: number;
  supported: number;
  disputed: number;
  partial: number;
  unverifiable: number;
  calls: number;
  callsDone: number;
  searches: number;
  durationMs: number;
  costUsd: number | null;
};

export const EMPTY_STATS: SessionStats = Object.freeze({
  claims: 0,
  supported: 0,
  disputed: 0,
  partial: 0,
  unverifiable: 0,
  calls: 0,
  callsDone: 0,
  searches: 0,
  durationMs: 0,
  costUsd: null,
});

export type Session = {
  id: string;
  userId: string;
  question: string;
  transcript: string | null;
  title: string | null;
  mode: SessionMode;
  status: SessionStatus;
  settingsSnapshot: unknown;
  stats: SessionStats;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Run = {
  id: string;
  sessionId: string;
  attempt: number;
  reason: RunReason;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
};

export type Citation = { title: string; url: string };

export type Call = {
  id: string;
  runId: string;
  kind: CallKind;
  provider: ProviderId;
  transport: Transport;
  model: string;
  status: CallStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  searches: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  text: string | null;
  html: string | null;
  citations: readonly Citation[];
  errorCode: string | null;
  errorMessage: string | null;
  pasted: boolean;
};

export type Claim = {
  id: string;
  callId: string;
  idx: number;
  claim: string;
  verdict: Verdict;
  note: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

export type NewCall = Pick<Call, "runId" | "kind" | "provider" | "transport" | "model"> &
  Partial<Omit<Call, "id" | "runId" | "kind" | "provider" | "transport" | "model">>;
export type NewClaim = Omit<Claim, "id" | "callId">;
