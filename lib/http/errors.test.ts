import { describe, expect, it } from "vitest";
import { errors, HttpError, isHttpError } from "./errors";

describe("errors", () => {
  it.each([
    [errors.badRequest({ a: 1 }), 400, "validation_failed"],
    [errors.unauthorized(), 401, "unauthorized"],
    [errors.forbidden(), 403, "forbidden"],
    [errors.forbidden("csrf", "Bad origin."), 403, "csrf"],
    [errors.notFound(), 404, "not_found"],
    [errors.conflict("dup", "Duplicate."), 409, "dup"],
    [errors.tooLarge(), 413, "payload_too_large"],
    [errors.unsupportedMedia(), 415, "unsupported_media_type"],
    [errors.rateLimited(7, "ip", 10), 429, "rate_limited"],
    [errors.unavailable("down", "Down."), 503, "down"],
  ])("%#", (e, status, code) => {
    expect(e.status).toBe(status);
    expect(e.code).toBe(code);
  });

  it("carries details and detects HttpError", () => {
    expect(errors.rateLimited(7, "ip", 10).details).toEqual({
      retryAfterSec: 7,
      layer: "ip",
      cost: 10,
    });
    expect(isHttpError(new HttpError(400, "x", "y"))).toBe(true);
    expect(isHttpError(new Error("x"))).toBe(false);
    expect(isHttpError(null)).toBe(false);
  });
});
