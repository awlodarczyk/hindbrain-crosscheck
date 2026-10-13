"use client";

import { Segmented } from "@/components/ui/segmented";
import type { Settings } from "@/lib/settings/schema";
import { NumberField } from "./number-field";

type Depth = Settings["tuning"]["webSearchDepth"];
const OPTIONS = [
  { value: "quick", label: "Quick" },
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep" },
] as const;

export type WebSearchRowProps = {
  max: number;
  depth: Depth;
  onMax: (value: number) => void;
  onDepth: (value: Depth) => void;
};

/** Search budget (0–20) and depth controls. */
export function WebSearchRow({ max, depth, onMax, onDepth }: WebSearchRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <NumberField
        label="Max searches"
        value={max}
        min={0}
        max={20}
        suffix="max"
        onChange={onMax}
      />
      <Segmented ariaLabel="Search depth" value={depth} onChange={onDepth} options={OPTIONS} />
    </div>
  );
}
