import type { SessionMode } from "@/lib/db/enums";

export type HistoryItem = {
  id: string;
  question: string;
  status: "queued" | "running" | "done" | "partial" | "failed";
  claims: number;
  disputed: number;
  callsDone: number;
  callsTotal: number;
  createdAt: string;
  mode?: SessionMode;
  /** Set only on soft-deleted sessions. */
  deletedAt?: string;
};

export type HistoryGroupLabel = "Today" | "Yesterday" | "Last 7 days" | "Older";

const ORDER: readonly HistoryGroupLabel[] = ["Today", "Yesterday", "Last 7 days", "Older"];

function dayIndex(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

function labelFor(createdAt: string, now: Date): HistoryGroupLabel {
  const age = dayIndex(now) - dayIndex(new Date(createdAt));
  if (age <= 0) return "Today";
  if (age === 1) return "Yesterday";
  if (age <= 7) return "Last 7 days";
  return "Older";
}

/** Buckets items (newest first) into labelled local-day groups; empty groups are omitted. */
export function groupByDay(
  items: readonly HistoryItem[],
  now: Date,
): ReadonlyArray<{ label: HistoryGroupLabel; items: readonly HistoryItem[] }> {
  return ORDER.map((label) => ({
    label,
    items: items.filter((i) => labelFor(i.createdAt, now) === label),
  })).filter((g) => g.items.length > 0);
}

/** Mono meta line shown under a history row's question. */
export function rowMeta(item: HistoryItem, formatTime: (iso: string) => string): string {
  switch (item.status) {
    case "running":
    case "queued":
      return `checking · ${item.callsDone} of ${item.callsTotal} calls`;
    case "failed":
      return `failed · ${formatTime(item.createdAt)}`;
    default:
      return `${item.claims} claims · ${item.disputed} disputed · ${formatTime(item.createdAt)}`;
  }
}
