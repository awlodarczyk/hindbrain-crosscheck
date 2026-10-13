import "server-only";
import pino, { type DestinationStream, type Logger } from "pino";
import { env, isTestRuntime } from "./env";
import { scrubValue } from "./security/scrub";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.headers.authorization",
  "*.headers.cookie",
  '*.headers["x-api-key"]',
  '*.headers["set-cookie"]',
  "*.*.headers.authorization",
  "*.*.headers.cookie",
  "*.apiKey",
  "*.*.apiKey",
  "*.password",
  "*.ciphertext",
  "*.token",
  '*["set-cookie"]',
  "authorization",
  "cookie",
  "apiKey",
  "password",
  "ciphertext",
  "token",
  '["x-api-key"]',
  "err.config.headers.authorization",
];

/** Builds a JSON logger with path redaction and key/bearer scrubbing; `stream` defaults to stdout. */
export function createLogger(level: string, stream?: DestinationStream): Logger {
  return pino(
    {
      level,
      base: { app: "hindbrain-crosscheck" },
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      formatters: { log: (obj) => scrubValue(obj) as Record<string, unknown> },
      hooks: {
        logMethod(args, method) {
          return method.apply(this, args.map((a) => scrubValue(a)) as Parameters<typeof method>);
        },
      },
    },
    stream,
  );
}

export const log: Logger = createLogger(isTestRuntime() ? "silent" : env.LOG_LEVEL);

export const childLogger = (bindings: Record<string, unknown>): Logger => log.child(bindings);
