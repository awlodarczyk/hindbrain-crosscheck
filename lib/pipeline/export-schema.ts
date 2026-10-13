import { z } from "zod";
import type { Call, Claim, Run, Session } from "@/lib/repos/types";
import type { SessionBundle } from "./report";

export const EXPORT_VERSION = 1 as const;
const MAX_SESSIONS = 500;
const iso = z.string();

export const CitationExport = z.object({ title: z.string(), url: z.string().url() });
export const ClaimExport = z.object({
  idx: z.number().int().min(0),
  claim: z.string().min(1).max(1000),
  verdict: z.enum(["supported", "disputed", "partial", "unverifiable"]),
  note: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  sourceTitle: z.string().nullable(),
});
export const CallExport = z.object({
  ref: z.string(),
  attempt: z.number().int().min(1),
  kind: z.enum(["answer", "review"]),
  provider: z.enum(["claude", "chatgpt"]),
  transport: z.enum(["anthropic-api", "openai-api", "claude-cli", "codex-cli", "mock"]),
  model: z.string(),
  status: z.enum(["queued", "running", "done", "failed", "skipped"]),
  startedAt: iso.nullable(),
  finishedAt: iso.nullable(),
  durationMs: z.number().nullable(),
  searches: z.number(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  costUsd: z.number().nullable(),
  text: z.string().nullable(),
  citations: z.array(CitationExport),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  pasted: z.boolean(),
  claims: z.array(ClaimExport),
});
export const RunExport = z.object({
  attempt: z.number().int().min(1),
  reason: z.enum(["initial", "manual", "disagreement"]),
  status: z.enum(["queued", "running", "done", "partial", "failed"]),
  startedAt: iso,
  finishedAt: iso.nullable(),
});
export const SessionExport = z.object({
  question: z.string().min(1).max(8000),
  title: z.string().nullable(),
  mode: z.enum(["ask", "paste"]),
  status: z.enum(["queued", "running", "done", "partial", "failed"]),
  settingsSnapshot: z.unknown(),
  stats: z.unknown(),
  createdAt: iso,
  updatedAt: iso,
  runs: z.array(RunExport),
  calls: z.array(CallExport),
});
export const ExportFileSchema = z.object({
  v: z.literal(EXPORT_VERSION),
  app: z.string(),
  exportedAt: iso,
  sessions: z.array(SessionExport).max(MAX_SESSIONS),
});
export type ExportFile = z.infer<typeof ExportFileSchema>;
type CallExportT = z.infer<typeof CallExport>;

export type ImportBundle = {
  session: Omit<Session, "id" | "userId" | "deletedAt">;
  runs: readonly Omit<Run, "id" | "sessionId">[];
  calls: readonly (Omit<Call, "id" | "runId" | "html"> & {
    attempt: number;
    claims: readonly Omit<Claim, "id" | "callId">[];
  })[];
};

export class ExportError extends Error {
  readonly code = "invalid_export_file" as const;
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

function exportCall(call: Call, attempt: number, claims: readonly Claim[]): CallExportT {
  return {
    kind: call.kind,
    provider: call.provider,
    transport: call.transport,
    model: call.model,
    status: call.status,
    startedAt: call.startedAt,
    finishedAt: call.finishedAt,
    durationMs: call.durationMs,
    searches: call.searches,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    costUsd: call.costUsd,
    text: call.text,
    errorCode: call.errorCode,
    errorMessage: call.errorMessage,
    pasted: call.pasted,
    ref: `r${attempt}-${call.kind}-${call.provider}`,
    attempt,
    citations: call.citations.map(({ title, url }) => ({ title, url })),
    claims: claims
      .filter((c) => c.callId === call.id)
      .sort((a, z) => a.idx - z.idx)
      .map(({ idx, claim, verdict, note, sourceUrl, sourceTitle }) => ({
        idx,
        claim,
        verdict,
        note,
        sourceUrl,
        sourceTitle,
      })),
  };
}

function exportSession(b: SessionBundle): ExportFile["sessions"][number] {
  const { question, title, mode, status, settingsSnapshot, stats, createdAt, updatedAt } =
    b.session;
  const attemptOf = new Map(b.runs.map((r) => [r.id, r.attempt]));
  return {
    question,
    title,
    mode,
    status,
    settingsSnapshot,
    stats,
    createdAt,
    updatedAt,
    runs: b.runs.map(({ attempt, reason, status: s, startedAt, finishedAt }) => ({
      attempt,
      reason,
      status: s,
      startedAt,
      finishedAt,
    })),
    calls: b.calls.map((c) => exportCall(c, attemptOf.get(c.runId) ?? 1, b.claims)),
  };
}

export function toExport(bundles: readonly SessionBundle[], now: Date): ExportFile {
  return {
    v: EXPORT_VERSION,
    app: "hindbrain crosscheck",
    exportedAt: now.toISOString(),
    sessions: bundles.map(exportSession),
  };
}

function importCall(c: CallExportT, warnings: string[]): ImportBundle["calls"][number] {
  const { ref, claims, ...rest } = c;
  const stale = c.status === "running" || c.status === "queued";
  if (stale) warnings.push(`call_interrupted:${ref}`);
  return {
    ...rest,
    ...(stale ? { status: "failed" as const, errorCode: "interrupted" } : {}),
    claims,
  };
}

export function fromExport(json: unknown): {
  bundles: readonly ImportBundle[];
  warnings: readonly string[];
} {
  const warnings: string[] = [];
  let input = json;
  if (
    typeof json === "object" &&
    json !== null &&
    Array.isArray((json as { sessions?: unknown }).sessions)
  ) {
    const sessions = (json as { sessions: unknown[] }).sessions;
    if (sessions.length > MAX_SESSIONS) {
      warnings.push("too_many_sessions");
      input = { ...json, sessions: sessions.slice(0, MAX_SESSIONS) };
    }
  }
  const parsed = ExportFileSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new ExportError(issues.join("; "));
  }
  const bundles = parsed.data.sessions.map(({ runs, calls, ...session }) => ({
    session: {
      ...session,
      settingsSnapshot: session.settingsSnapshot,
      stats: session.stats as Session["stats"],
    },
    runs,
    calls: calls.map((c) => importCall(c, warnings)),
  }));
  return { bundles, warnings };
}
