"use client";

import * as React from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";
import { focusRing } from "./ring";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  size?: "sm" | "md";
  ariaLabel: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      rovingFocus
      aria-label={ariaLabel}
      role="radiogroup"
      onValueChange={(next) => {
        const match = options.find((o) => o.value === next);
        if (match) onChange(match.value);
      }}
      className="inline-flex rounded-control bg-bg-muted p-0.5"
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          role="radio"
          onFocus={() => {
            if (o.value !== value) onChange(o.value);
          }}
          aria-checked={o.value === value}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[4px] px-3 text-[13px] font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-bg-card data-[state=on]:text-text-primary data-[state=on]:shadow-sm",
            size === "sm" ? "h-6" : "h-7",
            focusRing,
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
