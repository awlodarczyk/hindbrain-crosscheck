import type { ProviderId } from "@/lib/db/enums";
import { PROVIDER_LABEL } from "@/lib/pipeline/prompts";
import type { Call, Claim } from "@/lib/repos/types";
import { CallPlaceholder } from "./call-state";
import { CardFrame } from "./card-frame";
import { ClaimRow } from "./claim-row";
import { callMeta } from "./meta-line";

/** `reviewer` checks `target`'s answer; shows one row per extracted claim. */
export function ReviewCard({
  reviewer,
  target,
  call,
  claims,
  onRetry,
}: {
  reviewer: ProviderId;
  target: ProviderId;
  call: Call | null;
  claims: readonly Claim[];
  onRetry?: (callId: string) => void;
}) {
  const title = `${PROVIDER_LABEL[reviewer]} checks ${PROVIDER_LABEL[target]}`;
  const flagged = claims.filter((c) => c.verdict === "disputed").length;
  const done = call?.status === "done";
  return (
    <CardFrame
      provider={reviewer}
      label={title}
      title={title}
      sub={done ? `${flagged} ${flagged === 1 ? "claim" : "claims"} flagged` : undefined}
      right={call ? callMeta(call) : undefined}
    >
      {done && claims.length > 0 ? (
        claims.map((c) => <ClaimRow key={c.id} claim={c} />)
      ) : (
        <div className="p-4">
          <CallPlaceholder
            call={call}
            provider={reviewer}
            waitingFor={
              done
                ? "No claims extracted."
                : `Starts when ${PROVIDER_LABEL[target]}'s answer lands.`
            }
            onRetry={onRetry}
          />
        </div>
      )}
    </CardFrame>
  );
}
