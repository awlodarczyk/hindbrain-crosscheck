import type { CallKind, ProviderId } from "@/lib/db/enums";
import type { Call } from "@/lib/repos/types";
import { statusLabel } from "./apply-event";
import { ErrorState } from "./error-state";
import { RunningState, StatusRow } from "./running-state";

/** Body for a call that has no result yet: running, failed, skipped or waiting. */
export function CallPlaceholder({
  call,
  provider,
  kind,
  waitingFor,
  onRetry,
}: {
  call: Call | null;
  provider: ProviderId;
  kind: CallKind;
  waitingFor?: string;
  onRetry?: (callId: string) => void;
}) {
  if (call?.status === "failed" || call?.status === "skipped") {
    return <ErrorState call={call} onRetry={onRetry} />;
  }
  if (call?.status === "running")
    return <RunningState call={call} provider={provider} kind={kind} />;
  if (waitingFor) return <p className="text-[13px] text-text-muted">{waitingFor}</p>;
  return <StatusRow running={false} label={statusLabel(call, provider, kind)} />;
}
