import { describe, expect, it } from "vitest";
import { SettingsSchema } from "@/lib/settings/schema";
import {
  createProvider,
  resolveProviderConfigs,
  transportFor,
  type TransportEnv,
} from "./registry";
import { uniqueCitations, type ModelRequest } from "./types";

const settings = (claude: "cli" | "api", chatgpt: "cli" | "api") => {
  const base = SettingsSchema.parse({});
  return {
    ...base,
    providers: {
      claude: { ...base.providers.claude, connection: claude },
      chatgpt: { ...base.providers.chatgpt, connection: chatgpt },
    },
  };
};
const env = (o: Partial<TransportEnv> = {}): TransportEnv => ({
  PROVIDER_TRANSPORT: "auto",
  CLI_ENABLED: "1",
  APP_MODE: "local",
  ...o,
});
const none = { claude: null, chatgpt: null };

describe("resolveProviderConfigs", () => {
  it("mock transport wins", () => {
    const c = resolveProviderConfigs(
      settings("cli", "api"),
      none,
      env({ PROVIDER_TRANSPORT: "mock" }),
    );
    expect([c.claude.transport, c.chatgpt.transport]).toEqual(["mock", "mock"]);
  });
  it("falls back to api when cli disabled", () => {
    const c = resolveProviderConfigs(
      settings("cli", "cli"),
      none,
      env({ CLI_ENABLED: "0", APP_MODE: "hosted" }),
    );
    expect(c.claude).toMatchObject({ transport: "anthropic-api", fallbackReason: "cli_disabled" });
    expect(c.chatgpt).toMatchObject({ transport: "openai-api", fallbackReason: "cli_disabled" });
  });
  it("uses cli when enabled", () => {
    const c = resolveProviderConfigs(settings("cli", "cli"), none, env());
    expect([c.claude.transport, c.chatgpt.transport]).toEqual(["claude-cli", "codex-cli"]);
  });
  it("env key beats secret; secret used otherwise; none is undefined", () => {
    const s = { claude: "sk-secret", chatgpt: "oa-secret" };
    const a = resolveProviderConfigs(
      settings("api", "api"),
      s,
      env({ ANTHROPIC_API_KEY: "sk-env" }),
    );
    expect(a.claude.apiKey).toBe("sk-env");
    expect(a.chatgpt.apiKey).toBe("oa-secret");
    const b = resolveProviderConfigs(settings("api", "api"), none, env());
    expect(b.claude.apiKey).toBeUndefined();
    expect(b.claude.fallbackReason).toBeUndefined();
  });
});

describe("createProvider", () => {
  it("builds mock", () => {
    expect(createProvider({ transport: "mock", id: "claude" }).id).toBe("claude");
  });
  it("placeholder rejects for unimplemented transports", async () => {
    const p = createProvider({ transport: "anthropic-api", id: "claude" });
    const r = {} as ModelRequest;
    await expect(p.call(r, { signal: new AbortController().signal })).rejects.toMatchObject({
      code: "provider_bad_response",
    });
    await expect(p.test(new AbortController().signal)).resolves.toMatchObject({ ok: false });
  });
});

describe("helpers", () => {
  it("uniqueCitations keeps first", () => {
    const out = uniqueCitations([
      { title: "a", url: "u1" },
      { title: "b", url: "u1" },
      { title: "c", url: "u2" },
    ]);
    expect(out.map((c) => c.title)).toEqual(["a", "c"]);
  });
  it("transportFor table", () => {
    expect(transportFor("claude", "cli")).toBe("claude-cli");
    expect(transportFor("claude", "api")).toBe("anthropic-api");
    expect(transportFor("chatgpt", "cli")).toBe("codex-cli");
    expect(transportFor("chatgpt", "api")).toBe("openai-api");
  });
});
