"use client";

import { Segmented } from "@/components/ui/segmented";
import type { Settings } from "@/lib/settings/schema";

type Effort = Settings["reasoningEffort"];
const OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
] as const;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export type EffortSegmentedProps = {
  value: Effort;
  estimate: { low: number; high: number };
  onChange: (value: Effort) => void;
};

/** Reasoning-effort toggle with the per-question cost estimate beside it. */
export function EffortSegmented({ value, estimate, onChange }: EffortSegmentedProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented ariaLabel="Reasoning effort" value={value} onChange={onChange} options={OPTIONS} />
      <span className="font-mono text-[12px] text-text-secondary">
        ≈ {usd.format(estimate.low)} → {usd.format(estimate.high)} per question
      </span>
    </div>
  );
}
