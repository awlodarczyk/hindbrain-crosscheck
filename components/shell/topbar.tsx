import Link from "next/link";
import type { ReactNode } from "react";
import { focusRing } from "@/components/ui/ring";
import { cn } from "@/lib/utils";

/** 48 px breadcrumb bar with right-aligned actions. */
export function Topbar({
  crumbs,
  actions,
}: {
  crumbs: readonly { label: string; href?: string }[];
  actions?: ReactNode;
}) {
  const last = crumbs.length - 1;
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-default px-5">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
        {crumbs.map((c, i) => (
          <span key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" className="text-text-muted">
                /
              </span>
            )}
            {i === last ? (
              <span
                aria-current="page"
                className="max-w-[420px] truncate font-medium text-text-primary"
              >
                {c.label}
              </span>
            ) : c.href ? (
              <Link
                href={c.href}
                className={cn(
                  "rounded-control text-text-secondary transition-colors hover:text-text-primary",
                  focusRing,
                )}
              >
                {c.label}
              </Link>
            ) : (
              <span className="text-text-secondary">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}
