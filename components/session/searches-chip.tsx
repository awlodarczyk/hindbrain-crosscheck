import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { chipClass } from "./model-chip";

const MAX = 20;
const clamp = (n: number) => Math.min(MAX, Math.max(0, Math.round(n)));

/** Numeric chip for the per-call web search cap, clamped to 0-20. */
export function SearchesChip({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn(chipClass, "cursor-text gap-1.5", disabled && "opacity-50")}>
      <Globe aria-hidden="true" className="size-3.5 text-text-muted" />
      <span className="text-text-secondary">Max searches</span>
      <input
        type="number"
        aria-label="Max searches"
        min={0}
        max={MAX}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className="w-7 bg-transparent text-right font-mono text-xs outline-none"
      />
    </label>
  );
}
