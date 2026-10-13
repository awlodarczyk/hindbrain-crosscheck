import type { SettingsView } from "@/lib/api/settings-dto";
import { SettingsSchema } from "@/lib/settings/schema";

const none = {
  source: "none",
  effective: "none",
  masked: null,
  valid: null,
  updatedAt: null,
} as const;
const absent = { found: false, checkedAt: "2026-01-01T00:00:00Z" };

/** Test fixture: a local view with no keys and no CLI, overridable per field. */
export function makeView(over: Partial<SettingsView> = {}): SettingsView {
  return {
    settings: SettingsSchema.parse({}),
    warnings: [],
    secrets: { claude: none, chatgpt: none },
    cli: { claude: absent, codex: absent },
    cliAllowed: true,
    estimate: { low: 0, high: 0 },
    models: {
      claude: [
        { id: "claude-opus-5-5", label: "Opus 5.5" },
        { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
      ],
      chatgpt: [{ id: "gpt-5.5", label: "GPT 5.5" }],
    },
    savedAt: null,
    mode: "local",
    transportMode: "auto",
    ...over,
  };
}
