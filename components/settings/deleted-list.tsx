"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { HistoryItem } from "@/components/shell/group-by-day";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { Section } from "./section";

const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const dateOf = (iso: string) => iso.slice(0, 10);

/** Soft-deleted sessions with a Restore action. */
export function DeletedList() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);

  useEffect(() => {
    let live = true;
    api.sessions
      .listDeleted()
      .then((r) => live && setItems(r.items))
      .catch((e: unknown) => {
        toast.error(messageOf(e, "Could not load deleted sessions"));
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const restore = useCallback(async (id: string) => {
    try {
      await api.sessions.restore(id);
    } catch (e) {
      toast.error(messageOf(e, "Could not restore the session"));
      return;
    }
    setItems((cur) => (cur ?? []).filter((i) => i.id !== id));
    toast.success("Session restored");
    window.dispatchEvent(new Event("hc:history-changed"));
  }, []);

  return (
    <Section title="Deleted sessions">
      {items === null && <p className="px-4 py-3 text-[13px] text-text-muted">Loading…</p>}
      {items?.length === 0 && (
        <p className="px-4 py-3 text-[13px] text-text-muted">Nothing deleted</p>
      )}
      {items?.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-text-primary">{i.question}</div>
            <div className="font-mono text-[12px] text-text-muted">
              created {dateOf(i.createdAt)}
            </div>
          </div>
          <Button
            variant="secondary"
            aria-label={`Restore ${i.question}`}
            onClick={() => void restore(i.id)}
          >
            <RotateCcw className="size-4" />
            Restore
          </Button>
        </div>
      ))}
    </Section>
  );
}
