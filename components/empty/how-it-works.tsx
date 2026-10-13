import { ArrowLeftRight, ListChecks, MessagesSquare } from "lucide-react";

const STEPS = [
  { n: "01", Icon: MessagesSquare, title: "Ask", body: "Both models answer in parallel" },
  {
    n: "02",
    Icon: ArrowLeftRight,
    title: "Cross-check",
    body: "Each answer is sent to the other model claim by claim",
  },
  {
    n: "03",
    Icon: ListChecks,
    title: "Read",
    body: "Supported, disputed and unverifiable claims with sources",
  },
] as const;

/** Three-step explainer under the composer. */
export function HowItWorks() {
  return (
    <ol aria-label="How it works" className="grid w-full gap-3 sm:grid-cols-3">
      {STEPS.map(({ n, Icon, title, body }) => (
        <li key={n} className="rounded-panel border border-border-default bg-bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-muted">{n}</span>
            <Icon aria-hidden="true" className="size-4 text-text-muted" />
          </div>
          <h2 className="mt-2 text-sm font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-[13px] text-text-secondary">{body}</p>
        </li>
      ))}
    </ol>
  );
}
