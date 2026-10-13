import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv, type EnvError } from "./env";
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
  it("requires VALKEY_URL and APP_URL in hosted mode", () => {
    expect(() => parseEnv({ ...base, APP_MODE: "hosted" })).toThrow(/VALKEY_URL.*APP_URL/s);
  });
  it("accepts a complete hosted env without admin vars", () => {
    const e = parseEnv({
      ...base,
      APP_MODE: "hosted",
      TRUST_PROXY: "1",
      CLI_ENABLED: "0",
      VALKEY_URL: "redis://valkey:6379",
      APP_URL: "https://crosscheck.example.com",
    });
    expect(e.ADMIN_EMAIL).toBeUndefined();
  });
  it("accepts a complete hosted env", () => {
    const e = parseEnv({
      ...base,
      APP_MODE: "hosted",
      TRUST_PROXY: "1",
      CLI_ENABLED: "0",
      VALKEY_URL: "redis://valkey:6379",
      ADMIN_EMAIL: "a@b.co",
      ADMIN_PASSWORD: "correct-horse-battery",
      APP_URL: "https://crosscheck.example.com",
    });
    expect(e.APP_MODE).toBe("hosted");
  });
  it("requires TRUST_PROXY=1 in hosted mode", () => {
    const full = {
      ...base,
      APP_MODE: "hosted",
      CLI_ENABLED: "0",
      VALKEY_URL: "redis://valkey:6379",
      ADMIN_EMAIL: "a@b.co",
      ADMIN_PASSWORD: "correct-horse-battery",
      APP_URL: "https://crosscheck.example.com",
    };
    expect(() => parseEnv(full)).toThrow(
      'TRUST_PROXY: must be "1" in hosted mode (app runs behind a reverse proxy)',
    );
    expect(parseEnv({ ...full, TRUST_PROXY: "1" }).TRUST_PROXY).toBe("1");
  });
  it("requires CLI_ENABLED=0 in hosted mode", () => {
    const full = {
      ...base,
      APP_MODE: "hosted",
      TRUST_PROXY: "1",
      VALKEY_URL: "redis://valkey:6379",
      APP_URL: "https://crosscheck.example.com",
    };
    expect(() => parseEnv(full)).toThrow('CLI_ENABLED: must be "0" in hosted mode');
    expect(() => parseEnv({ ...full, CLI_ENABLED: "1" })).toThrow(/CLI_ENABLED: must be "0"/);
    expect(parseEnv({ ...full, CLI_ENABLED: "0" }).CLI_ENABLED).toBe("0");
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
    ).toThrow(/VALKEY_URL.*APP_URL/s);
  });
  it("reports hosted requirements alongside other invalid keys", () => {
    expect(() => parseEnv({ APP_SECRET: "short", APP_MODE: "hosted" })).toThrow(
      /APP_SECRET[\s\S]*VALKEY_URL[\s\S]*APP_URL/,
    );
  });
  it("reports an invalid hosted APP_URL exactly once", () => {
    const full = {
      ...base,
      APP_MODE: "hosted",
      TRUST_PROXY: "1",
      CLI_ENABLED: "0",
      VALKEY_URL: "redis://valkey:6379",
      ADMIN_EMAIL: "a@b.co",
      ADMIN_PASSWORD: "correct-horse-battery",
      APP_URL: "not-a-url",
    };
    try {
      parseEnv(full);
      expect.unreachable();
    } catch (e) {
      expect((e as EnvError).issues.filter((l) => l.startsWith("APP_URL"))).toHaveLength(1);
    }
  });
  it("does not mention hosted keys in local mode", () => {
    expect(() => parseEnv({ APP_SECRET: "short" })).toThrow(
      expect.objectContaining({
        message: expect.not.stringMatching(/VALKEY_URL|ADMIN_EMAIL|ADMIN_PASSWORD|APP_URL/),
      }),
    );
  });
});

describe("env singleton", () => {
  const saved = process.env.APP_SECRET;
  afterEach(() => {
    if (saved === undefined) delete process.env.APP_SECRET;
    else process.env.APP_SECRET = saved;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not throw on import, only on access, when APP_SECRET is unset", async () => {
    delete process.env.APP_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const mod = await import("./env");
    expect(() => mod.env.APP_MODE).toThrow(mod.EnvError);
  });

  it("falls back to the test secret under vitest", async () => {
    delete process.env.APP_SECRET;
    vi.resetModules();
    const mod = await import("./env");
    expect(mod.env.APP_MODE).toBe("local");
    expect(Object.keys(mod.env)).toContain("PORT");
    expect("PORT" in mod.env).toBe(true);
    mod.resetEnvForTests();
  });
});
