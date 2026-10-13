import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] items-center rounded-[4px] border border-border-default bg-bg-subtle px-1.5 font-mono text-[11px] text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}
