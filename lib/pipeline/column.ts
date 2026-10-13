import type { Db } from "@/lib/db/client";
import type { ProviderId } from "@/lib/db/enums";
import { getCall, updateCall } from "@/lib/repos/calls";
import { replaceClaims } from "@/lib/repos/claims";
import type { Call } from "@/lib/repos/types";
import type { ModelRequest, ModelResult, Provider } from "@/lib/providers/types";
import { renderMarkdown } from "@/lib/security/sanitize";
import type { Settings } from "@/lib/settings/schema";
import { clock, emitDone, fail, settle, upsertCall, type CallPatch } from "./call-rows";
import { parseReview } from "./claims-parser";
import { estimateCost } from "./cost";
import type { EmitFn } from "./events";
import * as prompts from "./prompts";
import type { ResolvedModels } from "./resolve-models";

export type ColumnDeps = {
  db: Db;
  providers: Record<ProviderId, Provider>;
  settings: Settings;
  models: ResolvedModels;
  emit: EmitFn;
  signal: AbortSignal;
  now?: () => Date;
  sessionId: string;
  runId: string;
  question: string;
};

/** One column: `answerer` answers, `reviewer` checks that answer. `existing` rows are reused. */
export type ColumnPlan = {
  answerer: ProviderId;
  reviewer: ProviderId;
  pastedAnswer?: string;
  existing?: { answerCallId?: string; reviewCallId?: string };
  only?: "answer" | "review";
};

type Started = { id: string; at: Date; result: ModelResult; provider: ProviderId; model: string };

/** Builds the provider request for an answer, or for a review of `extra.answerText`. */
export function buildRequest(
  kind: "answer" | "review",
  deps: Pick<ColumnDeps, "settings" | "models" | "question">,
  provider: ProviderId,
  extra?: { answerText: string; answerProvider: ProviderId },
): ModelRequest {
  const { settings, question, models } = deps;
  const ctx = { settings, question };
  if (kind === "review" && !extra) throw new Error("review request needs the answer text");
  return {
    kind,
    system: kind === "answer" ? prompts.answerSystemPrompt(ctx) : prompts.reviewSystemPrompt(ctx),
    user: extra ? prompts.reviewUserPrompt({ ...ctx, ...extra }) : prompts.answerUserPrompt(ctx),
    model: kind === "answer" ? models[provider].answer : models[provider].verification,
    maxSearches: Math.min(settings.tuning.webSearchMax, settings.cost.maxSearchesPerCall),
    temperature: settings.tuning.temperature,
    reasoningEffort: settings.reasoningEffort,
    timeoutMs: settings.cost.timeoutSeconds * 1000,
    preferredDomains: settings.tuning.preferredDomains,
  };
}

/** Opens a running call row and invokes the provider; on failure marks the row and returns null. */
async function invoke(
  deps: ColumnDeps,
  provider: ProviderId,
  existingId: string | undefined,
  req: ModelRequest,
): Promise<Started | null> {
  const at = clock(deps);
  const { id } = upsertCall(deps, req.kind, provider, existingId, {
    model: req.model,
    status: "running",
    startedAt: at.toISOString(),
  });
  const { sessionId, emit, db } = deps;
  emit({ type: "call.started", sessionId, callId: id, kind: req.kind, provider, model: req.model });
  try {
    const result = await deps.providers[provider].call(req, {
      signal: deps.signal,
      onProgress: (p) => {
        updateCall(db, id, { searches: p.searches });
        emit({ type: "call.progress", sessionId, callId: id, ...p });
      },
    });
    return { id, at, result, provider, model: req.model };
  } catch (e) {
    fail(deps, id, e);
    return null;
  }
}

function complete(deps: ColumnDeps, call: Started, extra: CallPatch = {}): Call {
  const { result, at, provider, model } = call;
  const finished = clock(deps);
  const { inputTokens, outputTokens, searches } = result.usage;
  const transport = deps.providers[provider].transport;
  return settle(deps, call.id, {
    status: "done",
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - at.getTime(),
    ...{ searches, inputTokens, outputTokens, citations: result.citations },
    costUsd: estimateCost({ model, inputTokens, outputTokens, searches, transport }),
    text: result.text,
    html: renderMarkdown(result.text),
    ...extra,
  });
}

function storePasted(deps: ColumnDeps, plan: ColumnPlan, text: string): string {
  const ts = clock(deps).toISOString();
  const { id } = upsertCall(deps, "answer", plan.answerer, plan.existing?.answerCallId, {
    model: "pasted",
    pasted: true,
    ...{ startedAt: ts, finishedAt: ts, durationMs: 0, text, html: renderMarkdown(text) },
  });
  emitDone(deps, settle(deps, id, { status: "done" }));
  return text;
}

/** Runs (or pastes) the answer; returns its text, or null when it failed. */
async function answerStep(deps: ColumnDeps, plan: ColumnPlan): Promise<string | null> {
  if (plan.pastedAnswer !== undefined) return storePasted(deps, plan, plan.pastedAnswer);
  const req = buildRequest("answer", deps, plan.answerer);
  const started = await invoke(deps, plan.answerer, plan.existing?.answerCallId, req);
  if (!started) return null;
  emitDone(deps, complete(deps, started));
  return started.result.text;
}

function storedAnswer(deps: ColumnDeps, plan: ColumnPlan): string | null {
  const id = plan.existing?.answerCallId;
  const call = id ? getCall(deps.db, id) : null;
  return call?.status === "done" ? call.text : null;
}

async function reviewStep(deps: ColumnDeps, plan: ColumnPlan, answerText: string): Promise<void> {
  const { answerer, reviewer } = plan;
  const req = buildRequest("review", deps, reviewer, { answerText, answerProvider: answerer });
  const started = await invoke(deps, reviewer, plan.existing?.reviewCallId, req);
  if (!started) return;
  const parsed = parseReview(started.result.text, {
    requireSourcePerClaim: deps.settings.verification.requireSourcePerClaim,
  });
  const claims = parsed.claims.map((c, idx) => ({ ...c, idx }));
  replaceClaims(deps.db, started.id, claims);
  const errorCode = parsed.parseStatus === "fallback" ? "review_unparsed" : null;
  emitDone(deps, complete(deps, started, { errorCode }), claims.length);
}

function skipReview(deps: ColumnDeps, plan: ColumnPlan): void {
  const reason = "answer_failed";
  const { id } = upsertCall(deps, "review", plan.reviewer, plan.existing?.reviewCallId, {
    model: deps.models[plan.reviewer].verification,
    errorCode: reason,
    errorMessage: "The answer failed, so there was nothing to review.",
  });
  settle(deps, id, { status: "skipped" });
  deps.emit({ type: "call.skipped", sessionId: deps.sessionId, callId: id, reason });
}

/**
 * Runs one cross-check column: the answer (or a pasted one), then the other provider's review.
 * Every outcome is persisted on the call rows; this function never rejects.
 */
export async function runColumn(deps: ColumnDeps, plan: ColumnPlan): Promise<void> {
  try {
    const answer = plan.only === "review" ? storedAnswer(deps, plan) : await answerStep(deps, plan);
    if (answer === null) return skipReview(deps, plan);
    await reviewStep(deps, plan, answer);
  } catch (e) {
    console.error("runColumn: unexpected pipeline error", e);
  }
}
