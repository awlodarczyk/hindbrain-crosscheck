import { describe, expect, it } from "vitest";
import { fail, ok } from "./envelope";

describe("envelope", () => {
  it("wraps data", () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
  });
  it("includes meta when given", () => {
    expect(ok([], { total: 0, page: 1, limit: 20 }).meta).toEqual({ total: 0, page: 1, limit: 20 });
  });
  it("builds an error", () => {
    expect(fail("x", "y")).toEqual({ ok: false, error: { code: "x", message: "y" } });
  });
  it("carries error details", () => {
    expect(fail("x", "y", { a: 1 }).error.details).toEqual({ a: 1 });
  });
});
