"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { HistoryItem } from "./group-by-day";
import { Sidebar } from "./sidebar";
import { useShortcuts } from "./use-shortcuts";

const ITEMS: readonly HistoryItem[] = [];
const STATUS_LINE = { mode: "local", host: "127.0.0.1:4173", keys: false } as const;

/** Two-column frame: history sidebar plus scrollable main area. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const activeId: string | null = null;
  const onNavigate = (id: string) => router.push(`/s/${id}`);
  const step = (delta: number) => {
    if (ITEMS.length === 0) return;
    const at = ITEMS.findIndex((i) => i.id === activeId);
    const next = ITEMS[Math.min(ITEMS.length - 1, Math.max(0, at + delta))];
    if (next) onNavigate(next.id);
  };
  const onNew = () => router.push("/");
  useShortcuts({ onNew, onNext: () => step(1), onPrev: () => step(-1) });
  return (
    <div className="grid h-dvh grid-cols-[264px_1fr] bg-bg-page">
      <Sidebar
        items={ITEMS}
        activeId={activeId}
        onNew={onNew}
        onSearch={() => {}}
        onNavigate={onNavigate}
        statusLine={STATUS_LINE}
      />
      <main className="min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
