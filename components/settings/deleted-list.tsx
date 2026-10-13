"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setFailed(false);
    setItems(null);
    try {
      const r = await api.sessions.listDeleted();
      if (mounted.current) setItems(r.items);
    } catch {
      if (mounted.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const restore = useCallback(
    async (id: string) => {
      if (pending.has(id)) return;
      setPending((p) => new Set(p).add(id));
      try {
        await api.sessions.restore(id);
      } catch (e) {
        if (!mounted.current) return;
        toast.error(messageOf(e, "Could not restore the session"));
        setPending((p) => new Set([...p].filter((x) => x !== id)));
        return;
      }
      if (!mounted.current) return;
      setItems((cur) => (cur ?? []).filter((i) => i.id !== id));
      toast.success("Session restored");
      window.dispatchEvent(new Event("hc:history-changed"));
    },
    [pending],
  );

  return (
    <Section title="Deleted sessions">
      {failed && (
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p role="alert" className="text-[13px] text-text-secondary">
            Could not load deleted sessions.
          </p>
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}
      {items === null && !failed && (
        <p className="px-4 py-3 text-[13px] text-text-muted">Loading…</p>
      )}
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
            disabled={pending.has(i.id)}
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
