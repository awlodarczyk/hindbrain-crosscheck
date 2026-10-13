import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";
const base = { APP_SECRET: "test-secret-32-bytes-minimum-length!!" };

describe("parseEnv", () => {
  it("applies defaults in local mode", () => {
    const e = parseEnv(base);
    expect(e).toMatchObject({
      APP_MODE: "local",
      PORT: 4173,
      DATA_DIR: "./data",
      TRUST_PROXY: "0",
    });
  });
  it("rejects a short APP_SECRET and names the key", () => {
    expect(() => parseEnv({ APP_SECRET: "short" })).toThrow(/APP_SECRET/);
  });
  it("requires VALKEY_URL, ADMIN_EMAIL, ADMIN_PASSWORD and APP_URL in hosted mode", () => {
    expect(() => parseEnv({ ...base, APP_MODE: "hosted" })).toThrow(
      /VALKEY_URL.*ADMIN_EMAIL.*ADMIN_PASSWORD.*APP_URL/s,
    );
  });
  it("accepts a complete hosted env", () => {
    const e = parseEnv({
      ...base,
      APP_MODE: "hosted",
      VALKEY_URL: "redis://valkey:6379",
      ADMIN_EMAIL: "a@b.co",
      ADMIN_PASSWORD: "correct-horse-battery",
      APP_URL: "https://crosscheck.example.com",
    });
    expect(e.APP_MODE).toBe("hosted");
  });
  it("lists every invalid key at once", () => {
    expect(() => parseEnv({ APP_SECRET: "short", PORT: "abc" })).toThrow(
      /APP_SECRET[\s\S]*PORT|PORT[\s\S]*APP_SECRET/,
    );
  });
  it("treats empty optional values as unset", () => {
    const e = parseEnv({ ...base, APP_URL: "", SMTP_URL: "" });
    expect(e.APP_URL).toBeUndefined();
    expect(e.SMTP_URL).toBeUndefined();
  });
  it("treats empty hosted requirements as missing", () => {
    expect(() =>
      parseEnv({
        ...base,
        APP_MODE: "hosted",
        VALKEY_URL: "",
        ADMIN_EMAIL: "",
        ADMIN_PASSWORD: "",
        APP_URL: "",
      }),
    ).toThrow(/VALKEY_URL.*ADMIN_EMAIL.*ADMIN_PASSWORD.*APP_URL/s);
  });
});
