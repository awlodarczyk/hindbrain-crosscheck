import type { HistoryItem } from "./group-by-day";
import { HistoryRow } from "./history-row";

/** Labelled run of history rows for one day bucket. */
export function HistoryGroup({
  label,
  items,
  activeId,
  onNavigate,
}: {
  label: string;
  items: readonly HistoryItem[];
  activeId: string | null;
  onNavigate: (id: string) => void;
}) {
  return (
    <section aria-label={label}>
      <h2 className="px-4 pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
        {label}
      </h2>
      {items.map((item) => (
        <HistoryRow
          key={item.id}
          item={item}
          active={item.id === activeId}
          href={`/s/${item.id}`}
          onNavigate={onNavigate}
        />
      ))}
    </section>
  );
}
