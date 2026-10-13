import * as React from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./ring";

export const fieldClass = `w-full rounded-control border border-border-default bg-bg-card px-3 text-[13px] text-text-primary transition-colors duration-150 placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input ref={ref} type={type} className={cn(fieldClass, "h-8", className)} {...props} />
  ),
);
Input.displayName = "Input";
