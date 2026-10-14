import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/transcript/roles";
import { splitTurns } from "@/lib/transcript/turns";

/** Scrollable list of imported-conversation turns with role labels; bodies render as plain text. */
export function TranscriptView({ text }: { text: string }) {
  return (
    <dl className="max-h-80 overflow-auto break-words border-t border-border-default">
      {splitTurns(text).map((turn, i) => (
        <div key={i} className={cn("px-4 py-2", turn.role === "user" && "bg-bg-subtle")}>
          {turn.role !== "other" && (
            <dt className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              {ROLE_LABEL[turn.role]}
            </dt>
          )}
          <dd className="m-0">
            <p className="whitespace-pre-wrap text-[13px] text-text-primary">{turn.text}</p>
          </dd>
        </div>
      ))}
    </dl>
  );
}
