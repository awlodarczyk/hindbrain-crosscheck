import "server-only";
import { localAuth, type AuthGuard } from "@/lib/auth/guard";
import { env } from "@/lib/env";
import { isHosted } from "@/lib/mode";
import { createMemoryLimiter } from "@/lib/rate-limit/memory";
import type { RateLimiter } from "@/lib/rate-limit/types";
import { errors } from "./errors";

type Deps = { limiter?: RateLimiter; auth?: AuthGuard };
const g = globalThis as typeof globalThis & { __hcDeps?: Deps; __hcOverrides?: Deps };

const valkeyConfigured = () => Boolean(env.VALKEY_URL) && !env.VALKEY_URL?.startsWith("memory://");

const valkeyPlaceholder: RateLimiter = {
  consume: async () => {
    throw errors.unavailable("limiter_unavailable", "Valkey limiter is not implemented yet");
  },
};

const hostedGuardPlaceholder: AuthGuard = async () => null;

export function getLimiter(): RateLimiter {
  if (g.__hcOverrides?.limiter) return g.__hcOverrides.limiter;
  g.__hcDeps ??= {};
  g.__hcDeps.limiter ??= valkeyConfigured() ? valkeyPlaceholder : createMemoryLimiter();
  return g.__hcDeps.limiter;
}

export function getAuthGuard(): AuthGuard {
  return g.__hcOverrides?.auth ?? (isHosted() ? hostedGuardPlaceholder : localAuth);
}

/** Overrides take precedence over the real singletons until reset; later calls merge. */
export function setDepsForTests(overrides: Deps): void {
  g.__hcOverrides = { ...g.__hcOverrides, ...overrides };
}

export function resetDepsForTests(): void {
  g.__hcOverrides = undefined;
  g.__hcDeps = undefined;
}
