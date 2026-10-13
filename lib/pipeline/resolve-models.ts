import type { ProviderId, Transport } from "@/lib/db/enums";
import { PROVIDER_IDS } from "@/lib/db/enums";
import { defaultModelFor } from "@/lib/providers/models";
import type { Settings } from "@/lib/settings/schema";

export type ResolvedModels = Record<ProviderId, { answer: string; verification: string }>;

/**
 * Picks the answer and verification model per provider.
 *
 * - answer: `settings.providers[p].answerModel`, or the catalogue default when empty.
 * - verification: `verificationModel`, falling back to the answer model when null/empty.
 * - When the transport is `codex-cli`, verification always equals answer: Codex signed in with a
 *   ChatGPT account rejects the mini models.
 */
export function resolveModels(
  settings: Settings,
  transports: Record<ProviderId, Transport>,
): ResolvedModels {
  const pick = (p: ProviderId) => {
    const cfg = settings.providers[p];
    const answer = cfg.answerModel || defaultModelFor(p).id;
    const verification = transports[p] === "codex-cli" ? answer : cfg.verificationModel || answer;
    return { answer, verification };
  };
  return Object.freeze(
    Object.fromEntries(PROVIDER_IDS.map((p) => [p, Object.freeze(pick(p))])),
  ) as ResolvedModels;
}
