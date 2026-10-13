import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "supported" | "disputed";

const TONE: Record<StatTone, string> = {
  neutral: "text-text-primary",
  supported: "text-status-supported",
  disputed: "text-status-disputed",
};

/** Compact labelled count; `value` null renders a dash while calls are running. */
export function StatTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  tone?: StatTone;
}) {
  const shown = value ?? "—";
  return (
    <div
      role="group"
      aria-label={`${label}: ${shown}`}
      className="flex h-9 items-center gap-2 rounded-control border border-border-default bg-bg-card px-3 text-[13px]"
    >
      <Icon aria-hidden className={cn("size-4", TONE[tone])} />
      <span className="text-text-secondary">{label}</span>
      <span className={cn("font-semibold tabular-nums", TONE[tone])}>{shown}</span>
    </div>
  );
}
