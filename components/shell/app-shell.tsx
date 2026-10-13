"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { HistoryItem } from "./group-by-day";
import { Drawer } from "./drawer";
import { MobileTopbar } from "./mobile-topbar";
import { Sidebar } from "./sidebar";
import { useMedia } from "./use-media";
import { useShortcuts } from "./use-shortcuts";

const ITEMS: readonly HistoryItem[] = [];
const STATUS_LINE = { mode: "local", host: "127.0.0.1:4173", keys: false } as const;

/** Two-column frame: history sidebar plus scrollable main area. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isMobile = useMedia("(max-width: 768px)");
  const [open, setOpen] = useState(false);
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
  const sidebar = (afterAction: () => void) => (
    <Sidebar
      items={ITEMS}
      activeId={activeId}
      onNew={() => {
        onNew();
        afterAction();
      }}
      onSearch={() => {}}
      onNavigate={(id) => {
        onNavigate(id);
        afterAction();
      }}
      statusLine={STATUS_LINE}
    />
  );
  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col bg-bg-page">
        <MobileTopbar title="hindbrain crosscheck" onMenu={() => setOpen(true)} />
        <Drawer open={open} onOpenChange={setOpen} title="Navigation">
          {sidebar(() => setOpen(false))}
        </Drawer>
        <main className="min-w-0 flex-1 overflow-y-auto text-base">{children}</main>
      </div>
    );
  }
  return (
    <div className="grid h-dvh grid-cols-[264px_1fr] bg-bg-page">
      {sidebar(() => {})}
      <main className="min-w-0 overflow-y-auto text-sm">{children}</main>
    </div>
  );
}
