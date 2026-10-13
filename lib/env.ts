import "server-only";
import { z } from "zod";

const HOSTED_REQUIRED = ["VALKEY_URL", "APP_URL"] as const;
const TRUST_PROXY_MESSAGE = 'must be "1" in hosted mode (app runs behind a reverse proxy)';
const CLI_MESSAGE = 'must be "0" in hosted mode';
const HOSTED_MESSAGE = "required when APP_MODE=hosted";
const TEST_APP_SECRET = "test-secret-32-bytes-minimum-length!!";

const BaseEnvSchema = z.object({
  APP_MODE: z.enum(["local", "hosted"]).default("local"),
  PORT: z.coerce.number().int().positive().default(4173),
  DATA_DIR: z.string().default("./data"),
  APP_SECRET: z.string().min(32),
  APP_URL: z.string().url().optional(),
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
  VALKEY_URL: z.string().url().optional(),
  CLI_ENABLED: z.enum(["0", "1"]).default("1"),
  PROVIDER_TRANSPORT: z.enum(["auto", "mock"]).default("auto"),
  MOCK_DELAY_MS: z.coerce.number().int().min(0).default(0),
  MOCK_FAIL: z.enum(["claude", "chatgpt"]).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  SMTP_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export const EnvSchema = BaseEnvSchema.superRefine((e, ctx) => {
  for (const key of missingHostedKeys(e)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: HOSTED_MESSAGE });
  }
  if (e.APP_MODE === "hosted" && e.TRUST_PROXY !== "1") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["TRUST_PROXY"],
      message: TRUST_PROXY_MESSAGE,
    });
  }
  if (e.APP_MODE === "hosted" && e.CLI_ENABLED !== "0") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["CLI_ENABLED"], message: CLI_MESSAGE });
  }
});

export type Env = z.infer<typeof BaseEnvSchema>;

function missingHostedKeys(
  e: { APP_MODE?: string } & Partial<Record<(typeof HOSTED_REQUIRED)[number], unknown>>,
) {
  return e.APP_MODE === "hosted" ? HOSTED_REQUIRED.filter((k) => e[k] === undefined) : [];
}

/** Thrown by {@link parseEnv}; `issues` holds one "KEY: reason" line per invalid key. */
export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment:\n${issues.join("\n")}`);
    this.name = "EnvError";
  }
}

/**
 * Validates raw environment variables; empty strings count as unset.
 * @throws EnvError listing every invalid key, including missing hosted-only keys.
 */
export function parseEnv(raw: Readonly<Record<string, string | undefined>>): Env {
  const normalized = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ""));
  const result = BaseEnvSchema.safeParse(normalized);
  const issues = result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const hosted = missingHostedKeys(normalized).map((k) => `${k}: ${HOSTED_MESSAGE}`);
  const proxy =
    normalized.APP_MODE === "hosted" && normalized.TRUST_PROXY !== "1"
      ? [`TRUST_PROXY: ${TRUST_PROXY_MESSAGE}`]
      : [];
  const cli =
    normalized.APP_MODE === "hosted" && normalized.CLI_ENABLED !== "0"
      ? [`CLI_ENABLED: ${CLI_MESSAGE}`]
      : [];
  const all = [
    ...issues,
    ...(issues.some((i) => i.startsWith("CLI_ENABLED:")) ? [] : cli),
    ...(issues.some((i) => i.startsWith("TRUST_PROXY:")) ? [] : proxy),
    ...hosted.filter((h) => !issues.some((i) => i.startsWith(h.split(":")[0] + ":"))),
  ];
  if (result.success && all.length === 0) return result.data;
  throw new EnvError(all);
}

/** True under vitest; the only place outside {@link getEnv} that reads `process.env.VITEST`. */
export const isTestRuntime = (): boolean => Boolean(process.env.VITEST);

const shouldFallBackToTestSecret = () =>
  Boolean(process.env.VITEST) && process.env.NODE_ENV === "test" && !process.env.APP_SECRET;

let memo: Env | undefined;

/** Parses process.env on first call and memoizes the result. */
export function getEnv(): Env {
  memo ??= parseEnv(
    shouldFallBackToTestSecret() ? { ...process.env, APP_SECRET: TEST_APP_SECRET } : process.env,
  );
  return memo;
}

/** Clears the memoized env so the next access re-parses process.env. */
export function resetEnvForTests(): void {
  memo = undefined;
}

/** Lazily parsed, read-only view of process.env (writes are ignored; use resetEnvForTests in tests); throws EnvError on first access if invalid. */
export const env: Env = new Proxy({} as Env, {
  get: (_, key) => getEnv()[key as keyof Env],
  has: (_, key) => key in getEnv(),
  ownKeys: () => Reflect.ownKeys(getEnv()),
  getOwnPropertyDescriptor: (_, key) => Reflect.getOwnPropertyDescriptor(getEnv(), key),
});
