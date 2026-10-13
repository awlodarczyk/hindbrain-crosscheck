"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { HistoryItem } from "./group-by-day";
import { Drawer } from "./drawer";
import { MobileTopbar } from "./mobile-topbar";
import { RowMenu } from "./row-menu";
import { SearchPalette } from "./search-palette";
import { Sidebar, type SidebarProps } from "./sidebar";
import { useMedia } from "./use-media";
import { useSessionList } from "./use-session-list";
import { useShortcuts } from "./use-shortcuts";

export type AppShellProps = {
  children: ReactNode;
  initialItems: readonly HistoryItem[];
  statusLine: SidebarProps["statusLine"];
};

const activeIdOf = (pathname: string | null): string | null =>
  /^\/s\/([^/]+)/.exec(pathname ?? "")?.[1] ?? null;

/** Two-column frame: history sidebar plus scrollable main area. */
export function AppShell({ children, initialItems, statusLine }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMedia("(max-width: 768px)");
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [now] = useState(() => new Date());
  const list = useSessionList(initialItems);
  const { items, refresh } = list;
  const activeId = activeIdOf(pathname);

  useEffect(() => {
    if (activeId) void refresh();
  }, [activeId, refresh]);

  const onNavigate = (id: string) => router.push(`/s/${id}`);
  const onNew = () => router.push("/");
  const step = (delta: number) => {
    if (items.length === 0) return;
    const at = items.findIndex((i) => i.id === activeId);
    const next = items[Math.min(items.length - 1, Math.max(0, at + delta))];
    if (next) onNavigate(next.id);
  };
  useShortcuts({
    onNew,
    onSearch: () => setSearching(true),
    onNext: () => step(1),
    onPrev: () => step(-1),
  });

  const onDelete = async (id: string) => {
    const deleted = await list.del(id);
    if (deleted && id === activeId) router.push("/");
  };

  const sidebar = (afterAction: () => void) => (
    <Sidebar
      items={items}
      activeId={activeId}
      now={now}
      onNew={() => {
        onNew();
        afterAction();
      }}
      onSearch={() => {
        afterAction();
        setSearching(true);
      }}
      onNavigate={(id) => {
        onNavigate(id);
        afterAction();
      }}
      renderRowActions={(item) => (
        <RowMenu item={item} onRename={list.rename} onDelete={onDelete} />
      )}
      statusLine={statusLine}
    />
  );
  const palette = (
    <SearchPalette open={searching} onOpenChange={setSearching} onSelect={(id) => onNavigate(id)} />
  );
  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col bg-bg-page">
        <MobileTopbar title="hindbrain crosscheck" onMenu={() => setOpen(true)} />
        <Drawer open={open} onOpenChange={setOpen} title="Navigation">
          {sidebar(() => setOpen(false))}
        </Drawer>
        <main className="min-w-0 flex-1 overflow-y-auto text-base">{children}</main>
        {palette}
      </div>
    );
  }
  return (
    <div className="grid h-dvh grid-cols-[264px_1fr] bg-bg-page">
      {sidebar(() => {})}
      <main className="min-w-0 overflow-y-auto text-sm">{children}</main>
      {palette}
    </div>
  );
}
