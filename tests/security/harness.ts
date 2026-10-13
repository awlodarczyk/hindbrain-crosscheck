import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { createBus } from "@/lib/jobs/bus";
import { createRunner, type Runner } from "@/lib/jobs/runner";
import { createMockProvider } from "@/lib/providers/mock";
import { createUser } from "@/lib/repos/users";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";

const allow = {
  consume: async () => ({ allowed: true, retryAfterSec: 0, remaining: 99, layer: null }),
};

export type Harness = { db: Db; runner: Runner; as: (userId: string) => void };

/** Installs an in-memory db, mock runner and a switchable auth override. */
export function installHarness(): Harness {
  const db = createTestDb();
  const bus = createBus();
  const runner = createRunner({
    db,
    bus,
    providersFor: async () => ({
      claude: createMockProvider("claude"),
      chatgpt: createMockProvider("chatgpt"),
    }),
    settingsFor: () => DEFAULT_SETTINGS,
  });
  let current = "";
  setDepsForTests({ db, runner, bus, limiter: allow, auth: async () => ({ userId: current }) });
  return {
    db,
    runner,
    as: (userId) => {
      current = userId;
    },
  };
}

export const uninstallHarness = resetDepsForTests;

export const newUser = (db: Db, email: string): string =>
  createUser(db, { email, passwordHash: "x" }).id;

export const sameOrigin = (url: string, method = "GET", body?: unknown): Request =>
  new Request(url, {
    method,
    headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
