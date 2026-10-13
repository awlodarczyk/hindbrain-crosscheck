import { describe, expect, it } from "vitest";
import { securityHeaders } from "./headers";

describe("securityHeaders", () => {
  it("sets the baseline in both modes", () => {
    for (const mode of ["local", "hosted"] as const) {
      const h = securityHeaders({ mode });
      expect(h["X-Content-Type-Options"]).toBe("nosniff");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
      expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    }
  });

  it("sends HSTS only when hosted", () => {
    expect(securityHeaders({ mode: "hosted" })["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(securityHeaders({ mode: "local" })["Strict-Transport-Security"]).toBeUndefined();
  });
});
