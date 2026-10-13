import { env as realEnv } from "@/lib/env";
import type { Db } from "@/lib/db/client";
import type { ProviderId } from "@/lib/db/enums";
import { estimateQuestionCost } from "@/lib/pipeline/cost";
import { detectCli } from "@/lib/providers/cli-detect";
import { modelsFor } from "@/lib/providers/models";
import type { TransportEnv } from "@/lib/providers/registry";
import { getSecret, listSecretRows } from "@/lib/repos/secrets";
import { getSettingsWithWarnings } from "@/lib/repos/settings";
import { deriveKey, mask } from "@/lib/security/crypto";
import type { SecretView, SettingsView } from "./settings-dto";

export type ViewDeps = {
  env?: TransportEnv;
  detect?: typeof detectCli;
  now?: () => Date;
};

const ENV_KEY: Record<ProviderId, "ANTHROPIC_API_KEY" | "OPENAI_API_KEY"> = {
  claude: "ANTHROPIC_API_KEY",
  chatgpt: "OPENAI_API_KEY",
};

type StoredSecret =
  | { broken: false; masked: string; updatedAt: string }
  | { broken: true; masked: null; updatedAt: string };

function secretView(envKey: string | undefined, stored: StoredSecret | null): SecretView {
  if (envKey) {
    return {
      source: stored ? "db" : "env",
      effective: "env",
      masked: mask(envKey),
      valid: true,
      updatedAt: stored?.updatedAt ?? null,
    };
  }
  if (stored?.broken) {
    return {
      source: "db",
      effective: "none",
      masked: null,
      valid: false,
      updatedAt: stored.updatedAt,
      broken: true,
    };
  }
  if (stored) {
    return {
      source: "db",
      effective: "db",
      masked: stored.masked,
      valid: null,
      updatedAt: stored.updatedAt,
    };
  }
  return { source: "none", effective: "none", masked: null, valid: null, updatedAt: null };
}

function storedSecret(db: Db, userId: string, provider: ProviderId): StoredSecret | null {
  const row = listSecretRows(db, userId).find((r) => r.provider === provider);
  if (!row) return null;
  try {
    const plain = getSecret(db, deriveKey(realEnv.APP_SECRET, "secrets"), userId, provider);
    return plain === null ? null : { broken: false, masked: mask(plain), updatedAt: row.updatedAt };
  } catch {
    return { broken: true, masked: null, updatedAt: row.updatedAt };
  }
}

/** Assembles everything the settings screen shows; never returns a plaintext key. */
export async function buildSettingsView(
  db: Db,
  userId: string,
  deps: ViewDeps = {},
): Promise<SettingsView> {
  const env = deps.env ?? realEnv;
  const detect = deps.detect ?? detectCli;
  const [claude, codex] = await Promise.all([detect("claude"), detect("codex")]);
  const { settings, warnings, updatedAt } = getSettingsWithWarnings(db, userId);
  return {
    settings,
    warnings,
    secrets: {
      claude: secretView(env[ENV_KEY.claude], storedSecret(db, userId, "claude")),
      chatgpt: secretView(env[ENV_KEY.chatgpt], storedSecret(db, userId, "chatgpt")),
    },
    cli: { claude, codex },
    cliAllowed: env.CLI_ENABLED === "1",
    estimate: estimateQuestionCost(settings),
    models: {
      claude: modelsFor("claude").map(({ id, label }) => ({ id, label })),
      chatgpt: modelsFor("chatgpt").map(({ id, label }) => ({ id, label })),
    },
    savedAt: updatedAt,
    mode: env.APP_MODE,
    transportMode: env.PROVIDER_TRANSPORT,
  };
}
