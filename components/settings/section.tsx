import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Uppercase label above a bordered card of rows. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">{title}</h2>
      <div className="divide-y divide-border-default rounded-panel border border-border-default bg-bg-card">
        {children}
      </div>
    </section>
  );
}

/** Title + subtitle on the left, control on the right. */
export function Row({
  title,
  sub,
  monoSub,
  children,
}: {
  title: string;
  sub?: string;
  monoSub?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-stretch gap-2 px-4 py-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4">
      <div className="min-w-0">
        <div className="text-base font-medium text-text-primary md:text-[13px]">{title}</div>
        {sub && (
          <div className={cn("text-sm text-text-secondary md:text-[12px]", monoSub && "font-mono")}>
            {sub}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
