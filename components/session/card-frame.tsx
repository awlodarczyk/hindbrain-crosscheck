import type { ReactNode } from "react";
import type { ProviderId } from "@/lib/db/enums";
import { cn } from "@/lib/utils";

const DOT: Record<ProviderId, string> = { claude: "bg-model-claude", chatgpt: "bg-model-chatgpt" };

/** Bordered card with a 40 px tinted header (dot, title, sub, right slot) and a body. */
export function CardFrame({
  provider,
  title,
  sub,
  right,
  label,
  children,
  footer,
}: {
  provider: ProviderId;
  title: string;
  sub?: string;
  right?: string;
  label: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article
      aria-label={label}
      className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-border-default bg-bg-card"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border-default bg-bg-subtle px-4">
        <span aria-hidden className={cn("size-2 rounded-[2px]", DOT[provider])} />
        <h3 className="text-[13px] font-medium text-text-primary">{title}</h3>
        {sub && <span className="truncate font-mono text-[12px] text-text-muted">{sub}</span>}
        {right && <span className="ml-auto font-mono text-[12px] text-text-muted">{right}</span>}
      </header>
      <div className="flex-1">{children}</div>
      {footer}
    </article>
  );
}
