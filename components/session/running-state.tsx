import type { CallKind, ProviderId } from "@/lib/db/enums";
import type { Call } from "@/lib/repos/types";
import { Skeleton } from "./skeleton";
import { statusLabel } from "./apply-event";

/** Pulsing dot plus a 13 px label. */
export function StatusRow({ label, running = true }: { label: string; running?: boolean }) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 text-[13px] font-medium text-text-secondary"
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${running ? "animate-pulse motion-reduce:animate-none bg-status-running" : "bg-border-default"}`}
      />
      {label}
    </p>
  );
}

/** Body of a call in flight: status row with search count and skeleton lines. */
export function RunningState({
  call,
  provider,
  kind,
}: {
  call: Call;
  provider: ProviderId;
  kind: CallKind;
}) {
  const n = call.searches;
  const label = `${statusLabel(call, provider, kind)}${n > 0 ? ` · ${n} ${n === 1 ? "search" : "searches"}` : ""}`;
  return (
    <div className="flex flex-col gap-3">
      <StatusRow label={label} />
      <Skeleton chips={kind === "review"} />
    </div>
  );
}
