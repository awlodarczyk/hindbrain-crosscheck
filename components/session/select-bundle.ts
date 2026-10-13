import type { CallKind, ProviderId } from "@/lib/db/enums";
import type { SessionDetail } from "@/lib/api/sessions-dto";
import type { Call, Claim, Run } from "@/lib/repos/types";
import { domainOf } from "./meta-line";

export type LatestView = {
  run: Run | null;
  answers: Record<ProviderId, Call | null>;
  /** Keyed by the provider that wrote the review. */
  reviews: Record<ProviderId, Call | null>;
  claimsByCall: Record<string, readonly Claim[]>;
  attempts: readonly number[];
};

export type SourceEntry = {
  url: string;
  title: string;
  domain: string;
  citedBy: readonly { kind: CallKind; provider: ProviderId }[];
};

/** Picks the run for `attempt` (default: the highest) and groups its calls and claims. */
export function selectLatest(detail: SessionDetail, attempt?: number): LatestView {
  const attempts = detail.runs.map((r) => r.attempt).sort((a, b) => a - b);
  const wanted = attempt ?? attempts.at(-1);
  const run = detail.runs.find((r) => r.attempt === wanted) ?? null;
  const answers: Record<ProviderId, Call | null> = { claude: null, chatgpt: null };
  const reviews: Record<ProviderId, Call | null> = { claude: null, chatgpt: null };
  const claimsByCall: Record<string, readonly Claim[]> = {};
  for (const call of detail.calls.filter((c) => run !== null && c.runId === run.id)) {
    (call.kind === "answer" ? answers : reviews)[call.provider] = call;
    claimsByCall[call.id] = detail.claims
      .filter((c) => c.callId === call.id)
      .toSorted((a, b) => a.idx - b.idx);
  }
  return { run, answers, reviews, claimsByCall, attempts };
}

/** Distinct cited urls across `calls`, in first-seen order. */
export function uniqueSources(calls: readonly Call[]): readonly SourceEntry[] {
  const map = new Map<string, SourceEntry>();
  for (const call of calls) {
    for (const c of call.citations) {
      const prev = map.get(c.url);
      const by = { kind: call.kind, provider: call.provider };
      const dup = prev?.citedBy.some((b) => b.kind === by.kind && b.provider === by.provider);
      map.set(c.url, {
        url: c.url,
        title: prev?.title ?? c.title,
        domain: domainOf(c.url),
        citedBy: dup ? prev!.citedBy : [...(prev?.citedBy ?? []), by],
      });
    }
  }
  return [...map.values()];
}
