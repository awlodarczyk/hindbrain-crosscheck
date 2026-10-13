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

const STEP: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Resolves the option a navigation key targets, or undefined for other keys. */
function nextEnabled<T extends string>(
  options: readonly SegmentedOption<T>[],
  current: T,
  key: string,
): T | undefined {
  const enabled = options.filter((o) => !o.disabled);
  if (key === "Home") return enabled.at(0)?.value;
  if (key === "End") return enabled.at(-1)?.value;
  const step = STEP[key];
  if (step === undefined || enabled.length === 0) return undefined;
  const idx = enabled.findIndex((o) => o.value === current);
  return enabled[(idx + step + enabled.length) % enabled.length]?.value;
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
      onKeyDown={(e) => {
        const next = nextEnabled(options, value, e.key);
        if (next === undefined) return;
        e.preventDefault();
        if (next !== value) onChange(next);
        e.currentTarget.querySelector<HTMLElement>(`[data-value="${CSS.escape(next)}"]`)?.focus();
      }}
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
          data-value={o.value}
          disabled={o.disabled}
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
