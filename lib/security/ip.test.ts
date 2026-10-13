import { describe, expect, it } from "vitest";
import { browserIdFromCookie, clientIp } from "./ip";

const req = (headers: Record<string, string>) => new Request("http://x.test/", { headers });

describe("clientIp", () => {
  it("ignores headers without trustProxy", () => {
    const r = req({ "x-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" });
    expect(clientIp(r, { trustProxy: false, socketIp: "3.3.3.3" })).toBe("3.3.3.3");
    expect(clientIp(r, { trustProxy: false })).toBe("unknown");
  });
  it("uses the last forwarded hop", () => {
    const r = req({ "x-forwarded-for": "1.1.1.1, 10.0.0.5" });
    expect(clientIp(r, { trustProxy: true })).toBe("10.0.0.5");
  });
  it("accepts IPv6", () => {
    expect(clientIp(req({ "x-forwarded-for": "2001:db8::1" }), { trustProxy: true })).toBe(
      "2001:db8::1",
    );
  });
  it("falls back on a garbage hop and never reads x-real-ip", () => {
    const r = req({ "x-forwarded-for": "1.1.1.1, nope", "x-real-ip": "2.2.2.2" });
    expect(clientIp(r, { trustProxy: true, socketIp: "4.4.4.4" })).toBe("4.4.4.4");
    expect(clientIp(r, { trustProxy: true })).toBe("unknown");
  });
  it("maps loopback host to 127.0.0.1 when local", () => {
    const r = new Request("http://localhost:4173/");
    expect(clientIp(r, { trustProxy: false, local: true })).toBe("127.0.0.1");
    expect(clientIp(new Request("http://example.com/"), { trustProxy: false, local: true })).toBe(
      "unknown",
    );
  });
});

describe("browserIdFromCookie", () => {
  const id = "abcdefghij_klmnop-QRST";
  it("reads hc_bid among other cookies", () => {
    expect(browserIdFromCookie(req({ cookie: `a=b; hc_bid=${id}; c=d` }))).toBe(id);
  });
  it.each(["short", "bad value!!bad value!!", "a".repeat(129)])("rejects %s", (v) => {
    expect(browserIdFromCookie(req({ cookie: `hc_bid=${v}` }))).toBeNull();
  });
  it("returns null without cookie", () => {
    expect(browserIdFromCookie(req({}))).toBeNull();
  });
});
