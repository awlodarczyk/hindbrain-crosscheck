import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { Verdict } from "@/lib/db/enums";
import type { Claim } from "@/lib/repos/types";
import { cn } from "@/lib/utils";
import { domainOf } from "./meta-line";

export const VERDICT_LABEL: Record<Verdict, string> = {
  supported: "Supported",
  disputed: "Disputed",
  partial: "Partial",
  unverifiable: "Unverifiable",
};

const VERDICT_TONE: Record<Verdict, BadgeTone> = {
  supported: "supported",
  disputed: "disputed",
  partial: "unverifiable",
  unverifiable: "unverifiable",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <Badge tone={VERDICT_TONE[verdict]}>{VERDICT_LABEL[verdict]}</Badge>;
}

const isHttpUrl = (u: string | null): u is string => {
  try {
    return u !== null && ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};

/** One reviewed claim: verdict, claim text with note, and the source domain. */
export function ClaimRow({ claim }: { claim: Claim }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[96px_1fr_auto] items-start gap-3 border-b border-border-default px-4 py-3 last:border-0",
        claim.verdict === "disputed" && "bg-bg-disputed",
      )}
    >
      <div>
        <VerdictBadge verdict={claim.verdict} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-text-primary">{claim.claim}</p>
        {claim.note && <p className="mt-0.5 text-[12px] text-text-secondary">{claim.note}</p>}
      </div>
      {isHttpUrl(claim.sourceUrl) && (
        <a
          href={claim.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[140px] truncate font-mono text-[12px] text-text-muted hover:text-text-primary hover:underline"
        >
          {domainOf(claim.sourceUrl)}
        </a>
      )}
    </div>
  );
}
