"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiClientError, api } from "@/lib/api/client";
import type { HistoryItem } from "./group-by-day";

const LIST_LIMIT = 50;

const messageOf = (e: unknown) =>
  e instanceof ApiClientError ? e.message : "Something went wrong. Try again.";

/**
 * Client-side copy of the history list with optimistic rename/delete.
 * All updates produce new arrays; failures roll back and raise an error toast.
 */
export function useSessionList(initial: readonly HistoryItem[]) {
  const [items, setItems] = useState<readonly HistoryItem[]>(initial);
  const latest = useRef(items);
  latest.current = items;

  const apply = useCallback((next: readonly HistoryItem[]) => {
    latest.current = next;
    setItems(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply((await api.sessions.list({ limit: LIST_LIMIT })).items);
    } catch {
      // Keep the stale list; the next refresh retries.
    }
  }, [apply]);

  const upsert = useCallback(
    (item: HistoryItem) => {
      const cur = latest.current;
      apply(
        cur.some((i) => i.id === item.id)
          ? cur.map((i) => (i.id === item.id ? item : i))
          : [item, ...cur],
      );
    },
    [apply],
  );

  const remove = useCallback(
    (id: string) => apply(latest.current.filter((i) => i.id !== id)),
    [apply],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      const before = latest.current;
      apply(before.map((i) => (i.id === id ? { ...i, question: title } : i)));
      try {
        await api.sessions.rename(id, title);
      } catch (e) {
        apply(before);
        toast.error(messageOf(e));
      }
    },
    [apply],
  );

  const del = useCallback(
    async (id: string): Promise<boolean> => {
      const before = latest.current;
      apply(before.filter((i) => i.id !== id));
      try {
        await api.sessions.remove(id);
        toast.success("Session deleted");
        return true;
      } catch (e) {
        apply(before);
        toast.error(messageOf(e));
        return false;
      }
    },
    [apply],
  );

  return { items, refresh, upsert, remove, rename, del };
}
