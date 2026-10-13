import { CircleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Call } from "@/lib/repos/types";

const SKIPPED: Record<string, string> = {
  answer_failed: "Skipped — the answer failed.",
  aborted: "Skipped — the run was cancelled.",
};

/** Body of a failed or skipped call; failed calls get a Retry button when `onRetry` is given. */
export function ErrorState({ call, onRetry }: { call: Call; onRetry?: (callId: string) => void }) {
  if (call.status === "skipped") {
    return (
      <p className="text-[13px] text-text-muted">{SKIPPED[call.errorCode ?? ""] ?? "Skipped."}</p>
    );
  }
  const interrupted = call.errorCode === "interrupted";
  const message = interrupted
    ? "The app restarted while this call was running."
    : (call.errorMessage ?? "This call failed.");
  return (
    <div className="flex flex-col items-start gap-3 rounded-control bg-bg-disputed p-3">
      <div className="flex items-start gap-2">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-status-disputed" />
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-text-primary">{message}</p>
          {call.errorCode && (
            <code className="font-mono text-[12px] text-text-muted">{call.errorCode}</code>
          )}
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={() => onRetry(call.id)}>
          <RefreshCw aria-hidden className="size-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
