import { describe, expect, it } from "vitest";
import { browserIdCookieHeader, issueBrowserId, verifyBrowserId } from "./client-id";

const secret = Buffer.alloc(32, 7);
const t0 = new Date("2026-01-01T00:00:00Z");
const plus = (sec: number) => new Date(t0.getTime() + sec * 1000);

describe("browser id", () => {
  it("roundtrips and computes age", () => {
    const v = issueBrowserId(secret, t0);
    const r = verifyBrowserId(secret, v, plus(301));
    expect(r?.ageSec).toBe(301);
    expect(r?.id).toBe(v.split(".")[0]);
  });
  it("rejects a tampered timestamp or signature", () => {
    const [id, ts, sig] = issueBrowserId(secret, t0).split(".") as [string, string, string];
    expect(
      verifyBrowserId(secret, `${id}.${(parseInt(ts, 36) - 1000000).toString(36)}.${sig}`, t0),
    ).toBeNull();
    expect(verifyBrowserId(secret, `${id}.${ts}.${sig.slice(0, -2)}AA`, t0)).toBeNull();
  });
  it("rejects a wrong secret", () => {
    expect(verifyBrowserId(Buffer.alloc(32, 8), issueBrowserId(secret, t0), t0)).toBeNull();
  });
  it.each([undefined, "", "a.b", "a.b.c.d", "x".repeat(40)])("rejects malformed %s", (v) => {
    expect(verifyBrowserId(secret, v, t0)).toBeNull();
  });
  it("rejects ids issued more than 60 s in the future, tolerates small skew", () => {
    const v = issueBrowserId(secret, plus(120));
    expect(verifyBrowserId(secret, v, t0)).toBeNull();
    expect(verifyBrowserId(secret, issueBrowserId(secret, plus(30)), t0)?.ageSec).toBe(0);
  });
  it("sets cookie flags", () => {
    const h = browserIdCookieHeader("v", { secure: false });
    expect(h).toBe("hc_bid=v; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000");
    expect(browserIdCookieHeader("v", { secure: true })).toMatch(/; Secure$/);
  });
  it("rejects ids older than 366 days", () => {
    const old = issueBrowserId(secret, t0);
    expect(verifyBrowserId(secret, old, plus(365 * 86_400))).not.toBeNull();
    expect(verifyBrowserId(secret, old, plus(367 * 86_400))).toBeNull();
  });
});
