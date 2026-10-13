import type { SessionStatus } from "@/lib/db/enums";
import type { Settings } from "@/lib/settings/schema";

export const DISAGREEMENT_THRESHOLD = 3;

/** True when a first-attempt run finished with enough disputed claims and re-running on disagreement is enabled. */
export function shouldRerunOnDisagreement(
  settings: Settings,
  result: { status: SessionStatus; disputed: number; attempt: number },
): boolean {
  return (
    settings.verification.rerunOnDisagreement &&
    result.disputed >= DISAGREEMENT_THRESHOLD &&
    result.attempt === 1 &&
    result.status !== "failed"
  );
}
