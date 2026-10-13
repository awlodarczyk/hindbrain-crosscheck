import { getDummyHash } from "@/lib/auth/password";
import { adminBootstrapWarning, bootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { getDb, type Db } from "@/lib/db/client";
import { PROVIDER_IDS, type ProviderId } from "@/lib/db/enums";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { isHosted } from "@/lib/mode";
import { ProviderError } from "@/lib/providers/errors";
import { createMockProvider } from "@/lib/providers/mock";
import { createProvider, resolveProviderConfigs } from "@/lib/providers/registry";
import type { Provider } from "@/lib/providers/types";
import { countUsers } from "@/lib/repos/users";
import { getSecret } from "@/lib/repos/secrets";
import { getSettings } from "@/lib/repos/settings";
import { deriveKey } from "@/lib/security/crypto";
import { createBus, type Bus } from "./bus";
import { sweepInterrupted } from "./boot";
import { createRunner, type Runner } from "./runner";

type Globals = typeof globalThis & {
  __hcBus?: Bus;
  __hcRunner?: Runner;
  __hcBooted?: boolean;
};
const g = globalThis as Globals;

/** Mock transport honouring the MOCK_DELAY_MS / MOCK_FAIL test knobs. */
function mockProvider(id: ProviderId): Provider {
  return createMockProvider(id, {
    delayMs: env.MOCK_DELAY_MS,
    failWith:
      env.MOCK_FAIL === id
        ? new ProviderError("provider_http", "mock failure (MOCK_FAIL)")
        : undefined,
  });
}

/** Decrypts a stored key; null when absent, unreadable, or the mock transport is active. */
function readSecret(db: Db, key: Buffer, userId: string, provider: ProviderId): string | null {
  if (env.PROVIDER_TRANSPORT === "mock") return null;
  try {
    return getSecret(db, key, userId, provider);
  } catch {
    log.warn({ provider, userId }, "stored provider secret is unreadable; continuing without it");
    return null;
  }
}

/** Builds one provider per id from the user's settings, stored secrets and env. */
export async function providersForUser(
  db: Db,
  userId: string,
): Promise<Record<ProviderId, Provider>> {
  const settings = getSettings(db, userId);
  const key = deriveKey(env.APP_SECRET, "secrets");
  const secrets = {
    claude: readSecret(db, key, userId, "claude"),
    chatgpt: readSecret(db, key, userId, "chatgpt"),
  };
  const configs = resolveProviderConfigs(settings, secrets, env);
  const entries = PROVIDER_IDS.map((id) => [
    id,
    env.PROVIDER_TRANSPORT === "mock" ? mockProvider(id) : createProvider(configs[id]),
  ]);
  return Object.fromEntries(entries) as Record<ProviderId, Provider>;
}

/** Sweeps calls interrupted by a previous process; runs at most once per process. */
export function bootOnce(): void {
  if (g.__hcBooted) return;
  g.__hcBooted = true;
  try {
    sweepInterrupted(getDb(), new Date());
  } catch (e) {
    log.error({ err: e }, "boot sweep of interrupted calls failed");
  }
  if (isHosted()) {
    getDummyHash();
    try {
      bootstrapAdmin(getDb(), env);
      const warning = adminBootstrapWarning(countUsers(getDb()), env);
      if (warning) log.error({}, warning);
    } catch (e) {
      log.error({ err: e }, "admin bootstrap failed");
    }
  }
}

export function getBus(): Bus {
  g.__hcBus ??= createBus();
  return g.__hcBus;
}

export function getRunner(): Runner {
  if (!g.__hcRunner) {
    bootOnce();
    const db = getDb();
    g.__hcRunner = createRunner({
      db,
      bus: getBus(),
      providersFor: (userId) => providersForUser(db, userId),
      settingsFor: (userId) => getSettings(db, userId),
    });
  }
  return g.__hcRunner;
}
