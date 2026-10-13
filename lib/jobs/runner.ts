import type { Db } from "@/lib/db/client";
import type { ProviderId, RunReason } from "@/lib/db/enums";
import { runSession } from "@/lib/pipeline/run-session";
import { shouldRerunOnDisagreement } from "@/lib/pipeline/rerun-policy";
import type { Provider } from "@/lib/providers/types";
import { latestRun } from "@/lib/repos/runs";
import { setSessionStatus } from "@/lib/repos/sessions";
import type { Settings } from "@/lib/settings/schema";
import type { Bus } from "./bus";

export type Job = {
  sessionId: string;
  userId: string;
  reason: RunReason;
  pasted?: Partial<Record<ProviderId, string>>;
  retryCallId?: string;
};

export type RunnerDeps = {
  db: Db;
  bus: Bus;
  providersFor: (userId: string) => Promise<Record<ProviderId, Provider>>;
  settingsFor: (userId: string) => Settings;
  concurrency?: number;
  now?: () => Date;
  onError?: (e: unknown, job: Job) => void;
};

export type Runner = {
  /** At most one active or queued job per session. */
  enqueue(job: Job): { queued: boolean; reason?: "already_active" };
  /** Aborts the active run or drops the queued job; true when something was cancelled. */
  cancel(sessionId: string): boolean;
  active(): readonly string[];
  pending(): readonly string[];
  /** Resolves once the queue and all active jobs are empty. */
  drain(): Promise<void>;
};

const DEFAULT_CONCURRENCY = 2;

/** In-process job queue that runs cross-check sessions in the background. */
export function createRunner(deps: RunnerDeps): Runner {
  const { db, bus, concurrency = DEFAULT_CONCURRENCY } = deps;
  let queue: Job[] = [];
  const running = new Map<string, AbortController>();
  let idle: Array<() => void> = [];

  const settle = (): void => {
    if (queue.length > 0 || running.size > 0) return;
    const waiting = idle;
    idle = [];
    waiting.forEach((resolve) => resolve());
  };

  const failSession = (job: Job): void => {
    try {
      setSessionStatus(db, job.sessionId, "failed", deps.now);
    } catch {
      // the status write is best effort; clients still get session.done
    }
    bus.emit({ type: "session.done", sessionId: job.sessionId, status: "failed", disputed: 0 });
  };

  const fail = (job: Job, e: unknown): void => {
    try {
      deps.onError?.(e, job);
    } catch {
      // a throwing hook must not skip the status update
    }
    failSession(job);
  };

  const execute = async (job: Job, signal: AbortSignal): Promise<Job | null> => {
    const providers = await deps.providersFor(job.userId);
    const settings = deps.settingsFor(job.userId);
    const { status, disputed } = await runSession(
      { db, providers, settings, emit: bus.emit, signal, now: deps.now },
      job.sessionId,
      { reason: job.reason, pasted: job.pasted, retryCallId: job.retryCallId },
    );
    const attempt = latestRun(db, job.sessionId)?.attempt ?? 1;
    return shouldRerunOnDisagreement(settings, { status, disputed, attempt })
      ? { sessionId: job.sessionId, userId: job.userId, reason: "disagreement" }
      : null;
  };

  const start = (job: Job): void => {
    const controller = new AbortController();
    running.set(job.sessionId, controller);
    execute(job, controller.signal)
      .catch((e: unknown) => {
        fail(job, e);
        return null;
      })
      .then((followUp) => {
        running.delete(job.sessionId);
        if (followUp) queue = [...queue, followUp];
        pump();
        settle();
      });
  };

  const pump = (): void => {
    while (running.size < concurrency && queue.length > 0) {
      const [next, ...rest] = queue;
      queue = rest;
      if (next) start(next);
    }
  };

  const runner: Runner = {
    enqueue(job) {
      if (running.has(job.sessionId) || queue.some((j) => j.sessionId === job.sessionId)) {
        return { queued: false, reason: "already_active" };
      }
      queue = [...queue, job];
      pump();
      return { queued: true };
    },
    cancel(sessionId) {
      const controller = running.get(sessionId);
      if (controller) {
        controller.abort();
        return true;
      }
      const queued = queue.find((j) => j.sessionId === sessionId);
      if (!queued) return false;
      queue = queue.filter((j) => j !== queued);
      failSession(queued);
      settle();
      return true;
    },
    active: () => [...running.keys()],
    pending: () => queue.map((j) => j.sessionId),
    drain: () =>
      queue.length === 0 && running.size === 0
        ? Promise.resolve()
        : new Promise((r) => idle.push(r)),
  };
  return runner;
}
