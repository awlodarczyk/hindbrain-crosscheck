"use client";

import { Toaster as Sonner } from "sonner";

/** App-wide toast outlet styled with design tokens. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[356px] max-w-[calc(100vw-32px)] items-center gap-2 rounded-card border border-border-default bg-bg-card px-4 py-3 text-[13px] text-text-primary shadow-lg",
        },
      }}
    />
  );
}
