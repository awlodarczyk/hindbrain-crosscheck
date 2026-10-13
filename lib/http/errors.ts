/** Error carrying an HTTP status and a stable machine-readable code; rendered by `defineRoute`. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const errors = {
  badRequest: (details?: unknown) =>
    new HttpError(400, "validation_failed", "Request is invalid.", details),
  unauthorized: () => new HttpError(401, "unauthorized", "Sign in to continue."),
  forbidden: (code = "forbidden", message = "Not allowed.") => new HttpError(403, code, message),
  notFound: () => new HttpError(404, "not_found", "Not found."),
  conflict: (code: string, message: string) => new HttpError(409, code, message),
  tooLarge: () => new HttpError(413, "payload_too_large", "Request body is too large."),
  unsupportedMedia: () => new HttpError(415, "unsupported_media_type", "Unsupported content type."),
  rateLimited: (retryAfterSec: number, layer: string | null) =>
    new HttpError(429, "rate_limited", "Too many requests. Try again shortly.", {
      retryAfterSec,
      layer,
    }),
  unavailable: (code: string, message: string) => new HttpError(503, code, message),
};

export function isHttpError(e: unknown): e is HttpError {
  return e instanceof HttpError;
}
