import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { putSecret } from "@/lib/repos/secrets";
import { ensureLocalUser, LOCAL_USER_ID as U } from "@/lib/repos/users";
import { deriveKey, mask } from "@/lib/security/crypto";
import type { CliInfo } from "@/lib/providers/cli-detect";
import { buildSettingsView } from "./settings-view";

const KEY = deriveKey("test-secret-32-bytes-minimum-length!!", "secrets");
const baseEnv = {
  APP_MODE: "local",
  CLI_ENABLED: "1",
  PROVIDER_TRANSPORT: "auto",
  ANTHROPIC_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
} as const;
const info = (found: boolean): CliInfo => ({ found, checkedAt: "2026-01-01T00:00:00.000Z" });
const detect = async (name: "claude" | "codex") =>
  name === "claude" ? { ...info(true), version: "1.2.3" } : info(false);
const DB_KEY = "sk-db-abcdefghijklmnopqrstuvwxyz1234";
const ENV_KEY = "sk-env-abcdefghijklmnopqrstuvwxyz9999";

describe("buildSettingsView", () => {
  it("reports none when no keys exist", async () => {
    const v = await buildSettingsView(createTestDb(), U, { env: baseEnv, detect });
    expect(v.secrets.claude).toEqual({
      source: "none",
      effective: "none",
      masked: null,
      valid: null,
      updatedAt: null,
    });
    expect(v.cliAllowed).toBe(true);
    expect(v.mode).toBe("local");
    expect(v.estimate.low).toBeLessThan(v.estimate.high);
    expect(v.models.claude.length).toBeGreaterThan(0);
    expect(v.models.chatgpt.length).toBeGreaterThan(0);
    expect(v.savedAt).toBeNull();
  });

  it("reflects cliAllowed and passes detect results through", async () => {
    const v = await buildSettingsView(createTestDb(), U, {
      env: { ...baseEnv, CLI_ENABLED: "0", APP_MODE: "hosted" },
      detect,
    });
    expect(v.cliAllowed).toBe(false);
    expect(v.mode).toBe("hosted");
    expect(v.cli.claude.version).toBe("1.2.3");
    expect(v.cli.codex.found).toBe(false);
  });

  it("masks a db secret", async () => {
    const db = createTestDb();
    ensureLocalUser(db);
    putSecret(db, KEY, U, "claude", DB_KEY);
    const v = await buildSettingsView(db, U, { env: baseEnv, detect });
    expect(v.secrets.claude).toMatchObject({ source: "db", effective: "db", valid: null });
    expect(v.secrets.claude.masked).toBe(mask(DB_KEY));
    expect(v.secrets.claude.masked?.endsWith("1234")).toBe(true);
    expect(v.secrets.claude.updatedAt).not.toBeNull();
    expect(v.secrets.chatgpt.source).toBe("none");
  });

  it("lets the env key win over the db key", async () => {
    const db = createTestDb();
    ensureLocalUser(db);
    putSecret(db, KEY, U, "claude", DB_KEY);
    const v = await buildSettingsView(db, U, {
      env: { ...baseEnv, ANTHROPIC_API_KEY: ENV_KEY },
      detect,
    });
    expect(v.secrets.claude).toMatchObject({
      source: "db",
      effective: "env",
      masked: mask(ENV_KEY),
      valid: true,
    });
  });

  it("reports env-only keys as source env", async () => {
    const v = await buildSettingsView(createTestDb(), U, {
      env: { ...baseEnv, OPENAI_API_KEY: ENV_KEY },
      detect,
    });
    expect(v.secrets.chatgpt).toMatchObject({ source: "env", effective: "env", valid: true });
  });
});
