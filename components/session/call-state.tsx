import { Button } from "@/components/ui/button";
import { PROVIDER_LABEL } from "@/lib/pipeline/prompts";
import type { Call } from "@/lib/repos/types";
import type { ProviderId } from "@/lib/db/enums";

const LINES = ["w-11/12", "w-full", "w-3/4"] as const;

/** Body for a call that has no result yet, or failed. */
export function CallPlaceholder({
  call,
  provider,
  waitingFor,
  onRetry,
}: {
  call: Call | null;
  provider: ProviderId;
  waitingFor?: string;
  onRetry?: (callId: string) => void;
}) {
  if (call?.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-2 text-[13px]">
        <p className="text-status-disputed">{call.errorMessage ?? "This call failed."}</p>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={() => onRetry(call.id)}>
            Retry
          </Button>
        )}
      </div>
    );
  }
  if (call?.status === "running") {
    return (
      <div role="status" className="flex flex-col gap-2">
        <p className="text-[13px] text-text-secondary">{PROVIDER_LABEL[provider]} is working…</p>
        {LINES.map((w) => (
          <div key={w} className={`h-3 rounded-control bg-bg-muted ${w}`} />
        ))}
      </div>
    );
  }
  return (
    <p className="text-[13px] text-text-muted">
      {call?.status === "skipped" ? "Skipped." : (waitingFor ?? "Not available.")}
    </p>
  );
}
