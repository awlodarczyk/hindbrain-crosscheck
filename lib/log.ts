import "server-only";
import pino, { type DestinationStream, type Logger } from "pino";
import { env } from "./env";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.apiKey",
  "*.password",
  "*.ciphertext",
  "*.token",
  "x-api-key",
  "authorization",
];

/** Builds a JSON logger with secret redaction; `stream` defaults to stdout. */
export function createLogger(level: string, stream?: DestinationStream): Logger {
  return pino(
    {
      level,
      base: { app: "hindbrain-crosscheck" },
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    },
    stream,
  );
}

const defaultLevel = () =>
  process.env.VITEST && !process.env.LOG_LEVEL ? "silent" : env.LOG_LEVEL;

export const log: Logger = createLogger(defaultLevel());

export const childLogger = (bindings: Record<string, unknown>): Logger => log.child(bindings);
