import { describe, expect, it } from "vitest";
import { allowedOriginFor, isSameOriginMutation } from "./csrf";

const ORIGIN = "https://app.example.com";
const req = (method: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { method, headers });

describe("isSameOriginMutation", () => {
  it.each([
    ["GET", {}, { ok: true }],
    ["HEAD", {}, { ok: true }],
    ["OPTIONS", {}, { ok: true }],
    ["POST", { "sec-fetch-site": "same-origin" }, { ok: true }],
    ["POST", { "sec-fetch-site": "none" }, { ok: true }],
    ["POST", { origin: ORIGIN }, { ok: true }],
    ["POST", { "sec-fetch-site": "cross-site" }, { ok: false, reason: "cross_site" }],
    ["POST", { "sec-fetch-site": "same-site" }, { ok: false, reason: "cross_site" }],
    ["DELETE", { origin: "https://evil.example" }, { ok: false, reason: "origin_mismatch" }],
    ["POST", {}, { ok: false, reason: "missing_origin" }],
  ])("%s %j", (method, headers, verdict) => {
    expect(isSameOriginMutation(req(method, headers), ORIGIN)).toEqual(verdict);
  });

  it("accepts a matching origin even when sec-fetch-site is same-site", () => {
    const r = req("POST", { "sec-fetch-site": "same-site", origin: ORIGIN });
    expect(isSameOriginMutation(r, ORIGIN)).toEqual({ ok: true });
  });
});

describe("allowedOriginFor", () => {
  it("uses the APP_URL origin when hosted", () => {
    const r = new Request("http://internal:3000/api/x");
    expect(allowedOriginFor(r, { APP_MODE: "hosted", APP_URL: "https://app.example.com/x" })).toBe(
      ORIGIN,
    );
  });

  it("uses the request host over http when local", () => {
    const r = new Request("http://127.0.0.1:4173/api/x", {
      headers: { host: "127.0.0.1:4173", "x-forwarded-proto": "https" },
    });
    expect(allowedOriginFor(r, { APP_MODE: "local", APP_URL: undefined })).toBe(
      "http://127.0.0.1:4173",
    );
  });

  it("rejects a non-loopback Host when local (DNS rebinding)", () => {
    const r = new Request("http://evil.com:4173/api/x", {
      method: "POST",
      headers: { host: "evil.com:4173", origin: "http://evil.com:4173" },
    });
    const allowed = allowedOriginFor(r, { APP_MODE: "local", APP_URL: undefined });
    expect(isSameOriginMutation(r, allowed)).toEqual({ ok: false, reason: "origin_mismatch" });
  });

  it.each(["localhost:3000", "127.0.0.1:4173", "[::1]:8080"])(
    "accepts loopback Host %s",
    (host) => {
      const r = new Request("http://x/api/x", { headers: { host } });
      expect(allowedOriginFor(r, { APP_MODE: "local", APP_URL: undefined })).toBe(`http://${host}`);
    },
  );
});
