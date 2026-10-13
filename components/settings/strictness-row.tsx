"use client";

import { Segmented } from "@/components/ui/segmented";
import type { Settings } from "@/lib/settings/schema";

type Strictness = Settings["verification"]["strictness"];
const OPTIONS = [
  { value: "lenient", label: "Lenient" },
  { value: "standard", label: "Standard" },
  { value: "strict", label: "Strict" },
] as const;
const HELPER: Record<Strictness, string> = {
  lenient: "Lenient: only claims that look wrong or misleading are flagged",
  standard: "Standard: specific claims need a source; common knowledge may pass",
  strict: "Strict: every number and date needs a source or is marked unverifiable",
};

export function StrictnessRow({
  value,
  onChange,
}: {
  value: Strictness;
  onChange: (v: Strictness) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <Segmented ariaLabel="Strictness" value={value} onChange={onChange} options={OPTIONS} />
      <span className="max-w-xs text-right text-[12px] text-text-secondary">{HELPER[value]}</span>
    </div>
  );
}
