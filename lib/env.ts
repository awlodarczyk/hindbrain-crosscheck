import "server-only";
import { z } from "zod";

const HOSTED_REQUIRED = ["VALKEY_URL", "ADMIN_EMAIL", "ADMIN_PASSWORD", "APP_URL"] as const;
const TEST_APP_SECRET = "test-secret-32-bytes-minimum-length!!";

export const EnvSchema = z
  .object({
    APP_MODE: z.enum(["local", "hosted"]).default("local"),
    PORT: z.coerce.number().int().positive().default(4173),
    DATA_DIR: z.string().default("./data"),
    APP_SECRET: z.string().min(32),
    APP_URL: z.string().url().optional(),
    TRUST_PROXY: z.enum(["0", "1"]).default("0"),
    VALKEY_URL: z.string().url().optional(),
    CLI_ENABLED: z.enum(["0", "1"]).default("1"),
    PROVIDER_TRANSPORT: z.enum(["auto", "mock"]).default("auto"),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(12).optional(),
    SMTP_URL: z.string().url().optional(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  })
  .superRefine((e, ctx) => {
    if (e.APP_MODE !== "hosted") return;
    for (const key of HOSTED_REQUIRED) {
      if (e[key] === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "required when APP_MODE=hosted" });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Thrown by {@link parseEnv}; `issues` holds one "KEY: reason" line per invalid key. */
export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment:\n${issues.join("\n")}`);
    this.name = "EnvError";
  }
}

/**
 * Validates raw environment variables.
 * @throws EnvError listing every invalid key.
 */
export function parseEnv(raw: Readonly<Record<string, string | undefined>>): Env {
  const result = EnvSchema.safeParse(raw);
  if (result.success) return result.data;
  throw new EnvError(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
}

/** Parsed once at import. Under Vitest a missing APP_SECRET falls back to a fixed test value. */
export const env: Env = parseEnv(
  process.env.VITEST && !process.env.APP_SECRET ? { ...process.env, APP_SECRET: TEST_APP_SECRET } : process.env,
);
