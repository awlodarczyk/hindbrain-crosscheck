"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { SessionDetail } from "@/lib/api/sessions-dto";
import type { RunEvent } from "@/lib/pipeline/events";
import { applyEvent } from "./apply-event";

export type Connection = "connecting" | "open" | "closed" | "error";

export type UseSessionEventsOptions = {
  onEvent?: (e: RunEvent) => void;
  refetch?: (id: string) => Promise<SessionDetail>;
  EventSourceImpl?: typeof EventSource;
};

const EVENT_TYPES: readonly RunEvent["type"][] = [
  "run.started",
  "call.started",
  "call.progress",
  "call.done",
  "call.failed",
  "call.skipped",
  "session.stats",
  "session.done",
];
const REFETCH_DEBOUNCE_MS = 150;
const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 8000;
const MAX_FAILURES = 3;

const isLive = (d: SessionDetail) =>
  d.session.status === "queued" || d.session.status === "running";

function parse<T>(ev: Event): T | null {
  try {
    return JSON.parse((ev as MessageEvent<string>).data) as T;
  } catch {
    return null;
  }
}

/**
 * Subscribes to `/api/sessions/:id/events` while the session is queued or running
 * (and after `reconnect()`), reducing live events into `detail`. Closes on `session.done`
 * and on unmount; retries after errors with 1 s to 8 s backoff, then reports `"error"`.
 */
export function useSessionEvents(
  id: string,
  initial: SessionDetail,
  opts: UseSessionEventsOptions = {},
) {
  const [detail, setDetail] = useState(initial);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [active, setActive] = useState(() => isLive(initial));
  const [attempt, setAttempt] = useState(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const failures = useRef(0);
  const refetchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const alive = useRef(true);

  const scheduleRefetch = useCallback(() => {
    clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      const fetcher = optsRef.current.refetch ?? ((sid: string) => api.sessions.get(sid));
      fetcher(id)
        .then((d) => alive.current && setDetail(d))
        .catch((e: unknown) => console.warn("session refetch failed", e));
    }, REFETCH_DEBOUNCE_MS);
  }, [id]);

  const reconnect = useCallback(() => {
    failures.current = 0;
    setActive(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(refetchTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const Impl = optsRef.current.EventSourceImpl ?? EventSource;
    const source = new Impl(`/api/sessions/${id}/events`);
    let retry: ReturnType<typeof setTimeout> | undefined;
    setConnection("connecting");

    source.addEventListener("snapshot", (ev) => {
      const snap = parse<SessionDetail>(ev);
      if (!snap) return;
      failures.current = 0;
      setConnection("open");
      setDetail(snap);
    });
    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (ev) => {
        const e = parse<RunEvent>(ev);
        if (!e) return;
        failures.current = 0;
        setDetail((d) => applyEvent(d, e));
        optsRef.current.onEvent?.(e);
        if (type === "call.done" || type === "session.done") scheduleRefetch();
        if (type === "session.done") {
          source.close();
          setConnection("closed");
          setActive(false);
        }
      });
    }
    source.onerror = () => {
      source.close();
      failures.current += 1;
      if (failures.current >= MAX_FAILURES) return setConnection("error");
      setConnection("connecting");
      const delay = Math.min(BACKOFF_START_MS * 2 ** (failures.current - 1), BACKOFF_MAX_MS);
      retry = setTimeout(() => setAttempt((n) => n + 1), delay);
    };

    return () => {
      clearTimeout(retry);
      source.close();
    };
  }, [id, active, attempt, scheduleRefetch]);

  return { detail, connection, setDetail, reconnect };
}
