import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldClass, "min-h-16 py-2", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";
