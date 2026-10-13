import type { RunEvent } from "@/lib/pipeline/events";

export type BusEvent = RunEvent & { id: number };

export type Bus = {
  /** Assigns the next per-session id, stores the event in the ring and delivers it; subscriber errors are swallowed. */
  emit(e: RunEvent): void;
  subscribe(sessionId: string, fn: (e: BusEvent) => void): () => void;
  /** Events with id greater than `afterId` (all when omitted). */
  replay(sessionId: string, afterId?: number): readonly BusEvent[];
  /** True between `run.started` and `session.done`. */
  isActive(sessionId: string): boolean;
  /** Drops the session's ring; deferred until the last subscriber leaves. */
  forget(sessionId: string): void;
};

type Options = {
  ringSize?: number;
  retentionMs?: number;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
};
type Listener = (e: BusEvent) => void;
type SessionState = { lastId: number; ring: BusEvent[]; active: boolean; forgetting: boolean };

const DEFAULT_RING_SIZE = 200;
const DEFAULT_RETENTION_MS = 10 * 60 * 1000;

/** Per-session pub/sub with a bounded replay ring. */
export function createBus(opts: Options = {}): Bus {
  const { ringSize = DEFAULT_RING_SIZE, retentionMs = DEFAULT_RETENTION_MS } = opts;
  const schedule = opts.setTimeoutFn ?? setTimeout;
  const states = new Map<string, SessionState>();
  const listeners = new Map<string, Set<Listener>>();

  const stateOf = (id: string): SessionState => {
    const existing = states.get(id);
    if (existing) return existing;
    const created: SessionState = { lastId: 0, ring: [], active: false, forgetting: false };
    states.set(id, created);
    return created;
  };

  const forget = (id: string): void => {
    if (listeners.get(id)?.size) {
      const state = states.get(id);
      if (state) state.forgetting = true;
      return;
    }
    states.delete(id);
  };

  const emit = (e: RunEvent): void => {
    const state = stateOf(e.sessionId);
    const event: BusEvent = { ...e, id: ++state.lastId };
    state.ring = [...state.ring, event].slice(-ringSize);
    if (e.type === "run.started") state.active = true;
    if (e.type === "session.done") {
      state.active = false;
      schedule(() => forget(e.sessionId), retentionMs).unref?.();
    }
    for (const fn of [...(listeners.get(e.sessionId) ?? [])]) {
      try {
        fn(event);
      } catch {
        // a failing subscriber must not affect emit or other subscribers
      }
    }
  };

  const subscribe = (sessionId: string, fn: Listener): (() => void) => {
    const set = listeners.get(sessionId) ?? new Set<Listener>();
    set.add(fn);
    listeners.set(sessionId, set);
    return () => {
      set.delete(fn);
      if (set.size > 0) return;
      listeners.delete(sessionId);
      if (states.get(sessionId)?.forgetting) states.delete(sessionId);
    };
  };

  return {
    emit,
    subscribe,
    replay: (id, afterId = 0) => (states.get(id)?.ring ?? []).filter((e) => e.id > afterId),
    isActive: (id) => states.get(id)?.active ?? false,
    forget,
  };
}
