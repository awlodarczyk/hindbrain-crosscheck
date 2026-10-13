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
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-text-primary">{title}</div>
        {sub && (
          <div className={cn("text-[12px] text-text-secondary", monoSub && "font-mono")}>{sub}</div>
        )}
      </div>
      {children}
    </div>
  );
}
