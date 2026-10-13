"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import type { Verdict } from "@/lib/db/enums";
import { PROVIDER_LABEL } from "@/lib/pipeline/prompts";
import type { Call, Claim } from "@/lib/repos/types";
import { VerdictBadge } from "./claim-row";
import { domainOf } from "./meta-line";

type Filter = "all" | "disputed" | "supported" | "other";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "disputed", label: "Disputed" },
  { value: "supported", label: "Supported" },
  { value: "other", label: "Other" },
] as const;

const ORDER: readonly Verdict[] = ["disputed", "partial", "unverifiable", "supported"];

const matches = (f: Filter, v: Verdict) =>
  f === "all" || f === v || (f === "other" && (v === "partial" || v === "unverifiable"));

/** Every claim of the shown attempt in one table, grouped by verdict. */
export function CrossCheckTable({
  reviews,
  claimsByCall,
}: {
  reviews: readonly Call[];
  claimsByCall: Record<string, readonly Claim[]>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = reviews
    .flatMap((call) => (claimsByCall[call.id] ?? []).map((claim) => ({ call, claim })))
    .filter((r) => matches(filter, r.claim.verdict))
    .toSorted((a, b) => ORDER.indexOf(a.claim.verdict) - ORDER.indexOf(b.claim.verdict));
  return (
    <div className="flex flex-col gap-3">
      <Segmented ariaLabel="Filter claims" value={filter} onChange={setFilter} options={OPTIONS} />
      <div className="overflow-x-auto rounded-panel border border-border-default bg-bg-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border-default bg-bg-subtle text-[12px] text-text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Verdict</th>
              <th className="px-4 py-2 font-medium">Claim</th>
              <th className="px-4 py-2 font-medium">Checked by</th>
              <th className="px-4 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ call, claim }) => (
              <tr
                key={claim.id}
                className={`border-b border-border-default last:border-0 ${claim.verdict === "disputed" ? "bg-bg-disputed" : ""}`}
              >
                <td className="px-4 py-3 align-top">
                  <VerdictBadge verdict={claim.verdict} />
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-text-primary">{claim.claim}</p>
                  {claim.note && <p className="text-[12px] text-text-secondary">{claim.note}</p>}
                </td>
                <td className="px-4 py-3 align-top text-text-secondary">
                  {PROVIDER_LABEL[call.provider]}
                </td>
                <td className="px-4 py-3 align-top font-mono text-[12px]">
                  {claim.sourceUrl && (
                    <a
                      href={claim.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-muted hover:text-text-primary hover:underline"
                    >
                      {domainOf(claim.sourceUrl)}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-[13px] text-text-secondary">No claims match.</p>
        )}
      </div>
    </div>
  );
}
