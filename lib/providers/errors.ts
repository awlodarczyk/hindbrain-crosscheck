export type ProviderErrorCode =
  | "no_credentials"
  | "timeout"
  | "network"
  | "provider_bad_response"
  | "provider_http"
  | "cli_not_found"
  | "cli_failed"
  | "aborted";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status?: number;
  /** Captured process stdout, set for CLI failures. */
  readonly stdout?: string;

  constructor(
    code: ProviderErrorCode,
    message: string,
    opts: { cause?: unknown; status?: number; stdout?: string } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "ProviderError";
    this.code = code;
    this.status = opts.status;
    this.stdout = opts.stdout;
  }
}

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError;
}
