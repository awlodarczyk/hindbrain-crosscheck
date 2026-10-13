import { cn } from "@/lib/utils";

const WIDTHS = ["w-[92%]", "w-[78%]", "w-[50%]"] as const;

/** Three muted placeholder lines; `chips` prefixes each with a source-chip block. */
export function Skeleton({ chips = false }: { chips?: boolean }) {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {WIDTHS.map((w) => (
        <div key={w} className="flex items-center gap-2">
          {chips && <div className="h-[22px] w-[84px] shrink-0 rounded-control bg-bg-muted" />}
          <div className={cn("h-3 rounded-control bg-bg-muted", chips ? "flex-1" : w)} />
        </div>
      ))}
    </div>
  );
}
