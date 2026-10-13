"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { focusRing } from "@/components/ui/ring";
import { cn } from "@/lib/utils";

/** Left-edge modal panel (Radix Dialog): focus trap, Esc to close, 200 ms slide-in. */
export function Drawer({
  open,
  onOpenChange,
  children,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  side?: "left";
  title: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          aria-modal="true"
          className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-border-default bg-bg-subtle transition-transform duration-200 starting:-translate-x-full motion-reduce:transition-none"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className="h-full overflow-y-auto [&>aside]:w-full [&>aside]:border-r-0">
            {children}
          </div>
          <DialogPrimitive.Close
            aria-label="Close menu"
            className={cn(
              "absolute right-1 top-1 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-control text-text-secondary hover:bg-bg-muted hover:text-text-primary",
              focusRing,
            )}
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
