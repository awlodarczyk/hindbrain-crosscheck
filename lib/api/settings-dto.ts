import { z } from "zod";
import type { ProviderId } from "@/lib/db/enums";
import type { CliInfo } from "@/lib/providers/cli-detect";
import type { Settings } from "@/lib/settings/schema";

export const ProviderParam = z.enum(["claude", "chatgpt"]);

export const PutSecretBody = z.object({
  provider: ProviderParam,
  apiKey: z
    .string()
    .min(20)
    .max(400)
    .regex(/^[\x21-\x7E]+$/, "printable ASCII only"),
});
export const DeleteSecretBody = z.object({ provider: ProviderParam });
/** `password` is required in hosted mode and ignored locally. */
export const RevealBody = z.object({ provider: ProviderParam, password: z.string().optional() });

export type SecretView = {
  source: "env" | "db" | "none";
  effective: "env" | "db" | "none";
  masked: string | null;
  valid: boolean | null;
  updatedAt: string | null;
};

export type SettingsView = {
  settings: Settings;
  warnings: readonly string[];
  secrets: Record<ProviderId, SecretView>;
  cli: Record<"claude" | "codex", CliInfo>;
  cliAllowed: boolean;
  estimate: { low: number; high: number };
  models: Record<ProviderId, readonly { id: string; label: string }[]>;
  savedAt: string | null;
  mode: "local" | "hosted";
};
