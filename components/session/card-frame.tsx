import type { ReactNode } from "react";
import type { ProviderId } from "@/lib/db/enums";
import { cn } from "@/lib/utils";
import { CollapsibleCard } from "./collapsible-card";

const DOT: Record<ProviderId, string> = { claude: "bg-model-claude", chatgpt: "bg-model-chatgpt" };

/** Bordered card: tinted header (dot, title, sub, right slot; a 44 px toggle when `collapsible`), body and footer. */
export function CardFrame({
  provider,
  title,
  sub,
  right,
  label,
  children,
  footer,
  collapsible,
  defaultOpen,
}: {
  provider: ProviderId;
  title: string;
  sub?: string;
  right?: string;
  label: string;
  children: ReactNode;
  footer?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <article
      aria-label={label}
      className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-border-default bg-bg-card"
    >
      <CollapsibleCard
        collapsible={collapsible}
        defaultOpen={defaultOpen}
        header={
          <>
            <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px]", DOT[provider])} />
            <span className="min-w-0 truncate text-[13px] font-medium text-text-primary">
              {title}
            </span>
            {sub && <span className="truncate font-mono text-[12px] text-text-muted">{sub}</span>}
            {right && (
              <span className="ml-auto shrink-0 font-mono text-[12px] text-text-muted">
                {right}
              </span>
            )}
          </>
        }
      >
        {children}
        {footer}
      </CollapsibleCard>
    </article>
  );
}
