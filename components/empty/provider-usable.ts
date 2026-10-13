import type { ProviderId } from "@/lib/db/enums";
import type { SettingsView } from "@/lib/api/settings-dto";

/** True when the provider can answer: an API key, an allowed CLI, or the mock transport. */
export function isProviderUsable(view: SettingsView, p: ProviderId): boolean {
  if (view.transportMode === "mock") return true;
  if (view.secrets[p].effective !== "none") return true;
  return view.cliAllowed && view.cli[p === "claude" ? "claude" : "codex"].found;
}
