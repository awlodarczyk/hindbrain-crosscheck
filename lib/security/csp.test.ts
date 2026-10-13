import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "./csp";

const scriptSrc = (csp: string) => csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";

describe("buildCsp", () => {
  it("allows scripts only by nonce and strict-dynamic", () => {
    const csp = buildCsp("abc123", { mode: "local", dev: false });
    expect(scriptSrc(csp)).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(scriptSrc(csp)).not.toContain("'unsafe-inline'");
    expect(scriptSrc(csp)).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("adds eval and websockets only in dev", () => {
    const dev = buildCsp("n", { mode: "local", dev: true });
    expect(scriptSrc(dev)).toContain("'unsafe-eval'");
    expect(dev).toContain("connect-src 'self' ws: wss:");
    expect(buildCsp("n", { mode: "local", dev: false })).toContain("connect-src 'self'; ");
  });

  it("upgrades insecure requests only when hosted", () => {
    expect(buildCsp("n", { mode: "hosted", dev: false })).toContain("upgrade-insecure-requests");
    expect(buildCsp("n", { mode: "local", dev: false })).not.toContain("upgrade-insecure-requests");
  });
});

describe("generateNonce", () => {
  it("is 16 random bytes in base64", () => {
    const a = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(generateNonce()).not.toBe(a);
  });
});
