"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { focusRing } from "./ring";

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-accent-default" />
    </SliderPrimitive.Track>
    {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
      <SliderPrimitive.Thumb
        key={i}
        className={cn(
          "block size-[14px] cursor-pointer rounded-full border-2 border-accent-default bg-bg-card transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
          focusRing,
        )}
      />
    ))}
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
