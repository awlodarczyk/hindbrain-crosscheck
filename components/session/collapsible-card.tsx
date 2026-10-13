"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { focusRing } from "@/components/ui/ring";
import { cn } from "@/lib/utils";

/**
 * Card header plus body. When `collapsible` the header is a 44 px toggle button
 * (`aria-expanded`) starting `defaultOpen`; otherwise the body is always shown.
 */
export function CollapsibleCard({
  header,
  children,
  collapsible = false,
  defaultOpen = false,
}: {
  header: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const bodyId = useId();
  const open = !collapsible || (override ?? defaultOpen);
  const bar = "flex shrink-0 items-center gap-2 border-b border-border-default bg-bg-subtle px-4";
  return (
    <>
      {collapsible ? (
        <h3 className="m-0 text-inherit">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOverride(!open)}
            className={cn(bar, "min-h-11 w-full cursor-pointer text-left", focusRing)}
          >
            {header}
            <ChevronDown
              aria-hidden
              className={cn("size-4 shrink-0 text-text-muted", open && "rotate-180")}
            />
          </button>
        </h3>
      ) : (
        <h3 className={cn(bar, "h-10")}>{header}</h3>
      )}
      <div id={bodyId} hidden={!open} className="flex-1">
        {children}
      </div>
    </>
  );
}
