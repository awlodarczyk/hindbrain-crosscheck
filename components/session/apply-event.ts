import type { SessionDetail } from "@/lib/api/sessions-dto";
import type { CallKind, ProviderId, SessionStatus } from "@/lib/db/enums";
import type { RunEvent } from "@/lib/pipeline/events";
import { PROVIDER_LABEL } from "@/lib/pipeline/prompts";
import type { Call, Run } from "@/lib/repos/types";

const TRANSPORT_BY_PROVIDER = { claude: "anthropic-api", chatgpt: "openai-api" } as const;

const blankCall = (
  id: string,
  runId: string,
): Omit<Call, "kind" | "provider" | "model" | "transport"> => ({
  id,
  runId,
  status: "running",
  startedAt: new Date().toISOString(),
  finishedAt: null,
  durationMs: null,
  searches: 0,
  inputTokens: null,
  outputTokens: null,
  costUsd: null,
  text: null,
  html: null,
  citations: [],
  errorCode: null,
  errorMessage: null,
  pasted: false,
});

const withCall = (d: SessionDetail, id: string, patch: Partial<Call>): SessionDetail => {
  if (!d.calls.some((c) => c.id === id)) return d;
  return { ...d, calls: d.calls.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
};

function startRun(d: SessionDetail, runId: string, attempt: number): SessionDetail {
  const session = { ...d.session, status: "running" as const };
  if (d.runs.some((r) => r.id === runId)) {
    return {
      ...d,
      session,
      runs: d.runs.map((r) => (r.id === runId ? { ...r, status: "running" as const } : r)),
    };
  }
  const run: Run = {
    id: runId,
    sessionId: d.session.id,
    attempt,
    reason: attempt > 1 ? "manual" : "initial",
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  return { ...d, session, runs: [...d.runs, run] };
}

function startCall(
  d: SessionDetail,
  e: Extract<RunEvent, { type: "call.started" }>,
): SessionDetail {
  const existing = d.calls.find((c) => c.id === e.callId);
  const runId = existing?.runId ?? d.runs.at(-1)?.id ?? "";
  const next: Call = {
    ...(existing ?? {
      ...blankCall(e.callId, runId),
      transport: TRANSPORT_BY_PROVIDER[e.provider],
    }),
    kind: e.kind,
    provider: e.provider,
    model: e.model,
    status: "running",
    startedAt: existing?.startedAt ?? new Date().toISOString(),
    finishedAt: null,
    errorCode: null,
    errorMessage: null,
  };
  return {
    ...d,
    calls: existing ? d.calls.map((c) => (c.id === e.callId ? next : c)) : [...d.calls, next],
  };
}

function finishRun(d: SessionDetail, status: SessionStatus): SessionDetail {
  const last = d.runs.length - 1;
  const finishedAt = new Date().toISOString();
  return {
    ...d,
    session: { ...d.session, status },
    runs: d.runs.map((r, i) => (i === last ? { ...r, status, finishedAt } : r)),
  };
}

/**
 * Pure reducer for live run events. Every handled branch returns a new object;
 * unknown event types and events for unknown calls return `detail` unchanged.
 * Text, html, citations and claims are not carried by events; callers refetch for those.
 */
export function applyEvent(detail: SessionDetail, e: RunEvent): SessionDetail {
  switch (e.type) {
    case "run.started":
      return startRun(detail, e.runId, e.attempt);
    case "call.started":
      return startCall(detail, e);
    case "call.progress":
      return withCall(detail, e.callId, { searches: e.searches });
    case "call.done":
      return withCall(detail, e.callId, {
        status: "done",
        durationMs: e.durationMs,
        searches: e.searches,
        finishedAt: new Date().toISOString(),
      });
    case "call.failed":
      return withCall(detail, e.callId, {
        status: "failed",
        errorCode: e.code,
        errorMessage: e.message,
        finishedAt: new Date().toISOString(),
      });
    case "call.skipped":
      return withCall(detail, e.callId, { status: "skipped", errorCode: e.reason });
    case "session.stats":
      return { ...detail, session: { ...detail.session, stats: e.stats, status: e.status } };
    case "session.done":
      return finishRun(detail, e.status);
    default:
      return detail;
  }
}

/** Human status line for a card body: "Claude is answering…", "Starts when Claude's answer lands". */
export function statusLabel(call: Call | null, provider: ProviderId, kind: CallKind): string {
  const who = PROVIDER_LABEL[provider];
  if (call?.status === "running") {
    return kind === "answer" ? `${who} is answering…` : `${who} is checking sources…`;
  }
  const target = PROVIDER_LABEL[provider === "claude" ? "chatgpt" : "claude"];
  return kind === "review" ? `Starts when ${target}'s answer lands` : "Waiting to start";
}
