"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { SessionDetail } from "@/lib/api/sessions-dto";

const INTERVAL_MS = 1500;
const MAX_MS = 60_000;
const SETTLED = new Set(["done", "partial", "failed"]);

/**
 * Polling fallback after a re-run or retry: re-fetches the session until it settles
 * (and, when `minRuns` is given, a newer run exists) or 60 s pass.
 */
export function useSessionPoll(id: string, onDetail: (d: SessionDetail) => void) {
  const [target, setTarget] = useState<{ minRuns: number } | null>(null);
  const start = useCallback((minRuns: number) => setTarget({ minRuns }), []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const deadline = Date.now() + MAX_MS;
    const tick = async () => {
      try {
        const d = await api.sessions.get(id);
        if (cancelled) return;
        onDetail(d);
        if (SETTLED.has(d.session.status) && d.runs.length >= target.minRuns)
          return setTarget(null);
      } catch {
        // transient failure: keep polling until the deadline
      }
      if (cancelled) return;
      if (Date.now() >= deadline) return setTarget(null);
      timer = setTimeout(() => void tick(), INTERVAL_MS);
    };
    let timer = setTimeout(() => void tick(), INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, target, onDetail]);

  return { polling: target !== null, start };
}
