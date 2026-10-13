"use client";

import { ChevronsUpDown, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { Kbd } from "@/components/ui/kbd";
import { focusRing } from "@/components/ui/ring";
import { cn } from "@/lib/utils";
import { groupByDay, type HistoryItem } from "./group-by-day";
import { HistoryGroup } from "./history-group";
import { Logo } from "./logo";
import { StatusLine } from "./status-line";

export type SidebarProps = {
  items: readonly HistoryItem[];
  activeId: string | null;
  onNew: () => void;
  onSearch: () => void;
  onNavigate: (id: string) => void;
  statusLine: { mode: "local" | "hosted"; host: string; keys: boolean };
  now?: Date;
};

const rowBase = cn(
  "mx-3 flex h-9 items-center gap-2 rounded-control px-3 text-[13px] transition-colors duration-150",
  focusRing,
);

/** 264 px history sidebar: lockup, search, new question, grouped history, settings and status. */
export function Sidebar({
  items,
  activeId,
  onNew,
  onSearch,
  onNavigate,
  statusLine,
  now = new Date(),
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[264px] flex-col border-r border-border-default bg-bg-subtle">
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <Logo />
        <button
          type="button"
          aria-label="Switch workspace"
          className={cn("rounded-control p-1 text-text-secondary hover:bg-bg-muted", focusRing)}
        >
          <ChevronsUpDown size={14} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={onSearch}
        className={cn(rowBase, "border border-border-default bg-bg-card")}
      >
        <Search size={14} aria-hidden="true" className="text-text-secondary" />
        <span className="flex-1 text-left text-text-secondary">Search</span>
        <Kbd>⌘K</Kbd>
      </button>
      <button
        type="button"
        onClick={onNew}
        className={cn(rowBase, "mt-1 text-text-primary hover:bg-bg-muted")}
      >
        <Plus size={16} aria-hidden="true" className="text-accent-default" />
        <span className="flex-1 text-left">New question</span>
        <Kbd>⌘N</Kbd>
      </button>
      <nav aria-label="History" className="min-h-0 flex-1 overflow-y-auto">
        {groupByDay(items, now).map((g) => (
          <HistoryGroup
            key={g.label}
            label={g.label}
            items={g.items}
            activeId={activeId}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
      <Link
        href="/settings"
        className={cn(
          rowBase,
          "mb-1 text-text-secondary hover:bg-bg-muted hover:text-text-primary",
        )}
      >
        <Settings size={16} aria-hidden="true" />
        Settings
      </Link>
      <StatusLine {...statusLine} />
    </aside>
  );
}
