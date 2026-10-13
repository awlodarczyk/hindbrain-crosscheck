import Link from "next/link";
import { cn } from "@/lib/utils";
import { rowMeta, type HistoryItem } from "./group-by-day";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const formatTime = (iso: string) => timeFormat.format(new Date(iso));

function dotClass(item: HistoryItem): string {
  switch (item.status) {
    case "running":
    case "queued":
      return "bg-status-running animate-pulse";
    case "partial":
      return "bg-status-unverifiable";
    case "failed":
      return "bg-status-disputed";
    default:
      return item.disputed > 0 ? "bg-status-disputed" : "bg-status-supported";
  }
}

/** One 52 px sidebar entry: status dot, truncated question and mono meta line. */
export function HistoryRow({
  item,
  active,
  href,
  onNavigate,
}: {
  item: HistoryItem;
  active: boolean;
  href: string;
  onNavigate?: (id: string) => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onNavigate(item.id);
      }}
      className={cn(
        "grid h-[52px] grid-cols-[8px_1fr] items-center gap-x-3 px-3 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-default",
        active ? "bg-bg-selected" : "hover:bg-bg-muted",
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", dotClass(item))} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-text-primary">
          {item.question}
        </span>
        <span className="block truncate font-mono text-[11px] text-text-muted">
          {rowMeta(item, formatTime)}
        </span>
      </span>
    </Link>
  );
}
