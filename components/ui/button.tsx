import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { focusRing } from "./ring";

export const buttonVariants = cva(
  `inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-3 text-[13px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`,
  {
    variants: {
      variant: {
        primary: "bg-accent-default text-accent-on hover:opacity-90",
        secondary: "bg-bg-card border border-border-default text-text-primary hover:bg-bg-muted",
        ghost: "bg-transparent text-text-primary hover:bg-bg-muted",
        danger:
          "text-status-disputed border border-status-disputed/40 bg-bg-card hover:bg-bg-disputed",
      },
      size: { sm: "h-7", md: "h-8", lg: "h-9" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = "Button";
