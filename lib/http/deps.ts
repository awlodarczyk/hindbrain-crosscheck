import "server-only";
import { createHostedAuth } from "@/lib/auth/hosted-guard";
import { localAuth, type AuthGuard } from "@/lib/auth/guard";
import { getDb, type Db } from "@/lib/db/client";
import { env } from "@/lib/env";
import type { Bus } from "@/lib/jobs/bus";
import { getBus, getRunner } from "@/lib/jobs/wiring";
import type { Runner } from "@/lib/jobs/runner";
import { isHosted } from "@/lib/mode";
import { createMemoryLimiter } from "@/lib/rate-limit/memory";
import type { RateLimiter } from "@/lib/rate-limit/types";
import { errors } from "./errors";

type Deps = { limiter?: RateLimiter; auth?: AuthGuard; db?: Db; runner?: Runner; bus?: Bus };
const g = globalThis as typeof globalThis & { __hcDeps?: Deps; __hcOverrides?: Deps };

const hostedAuth = createHostedAuth(() => getRequestDb());

const valkeyConfigured = () => Boolean(env.VALKEY_URL) && !env.VALKEY_URL?.startsWith("memory://");

const valkeyPlaceholder: RateLimiter = {
  consume: async () => {
    throw errors.unavailable("limiter_unavailable", "Valkey limiter is not implemented yet");
  },
};

export function getLimiter(): RateLimiter {
  if (g.__hcOverrides?.limiter) return g.__hcOverrides.limiter;
  g.__hcDeps ??= {};
  g.__hcDeps.limiter ??= valkeyConfigured() ? valkeyPlaceholder : createMemoryLimiter();
  return g.__hcDeps.limiter;
}

export function getAuthGuard(): AuthGuard {
  return g.__hcOverrides?.auth ?? (isHosted() ? hostedAuth : localAuth);
}

export const getRequestDb = (): Db => g.__hcOverrides?.db ?? getDb();
export const getRequestRunner = (): Runner => g.__hcOverrides?.runner ?? getRunner();
export const getRequestBus = (): Bus => g.__hcOverrides?.bus ?? getBus();

/** Overrides take precedence over the real singletons until reset; later calls merge. */
export function setDepsForTests(overrides: Deps): void {
  g.__hcOverrides = { ...g.__hcOverrides, ...overrides };
}

export function resetDepsForTests(): void {
  g.__hcOverrides = undefined;
  g.__hcDeps = undefined;
}
