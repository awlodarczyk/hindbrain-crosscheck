import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  supported: "text-status-supported border-status-supported/30 bg-status-supported/10",
  disputed: "text-status-disputed border-status-disputed/30 bg-status-disputed/10",
  unverifiable: "text-status-unverifiable border-status-unverifiable/30 bg-status-unverifiable/10",
  partial: "text-status-unverifiable border-status-unverifiable/30 bg-status-unverifiable/10",
  running: "text-status-running border-status-running/30 bg-status-running/10",
  neutral: "text-text-secondary border-border-default bg-bg-subtle",
  claude: "text-text-primary border-border-default bg-bg-subtle",
  chatgpt: "text-text-primary border-border-default bg-bg-subtle",
} as const;

export type BadgeTone = keyof typeof tones;

const dotClass: Partial<Record<BadgeTone, string>> = {
  claude: "bg-model-claude",
  chatgpt: "bg-model-chatgpt",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Leading 8px square dot; defaults to true for model tones. */
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot, className, children, ...props }: BadgeProps) {
  const color = dotClass[tone];
  const showDot = (dot ?? true) && color !== undefined;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-control border px-2 text-[12px] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {showDot && <span aria-hidden className={cn("size-2 rounded-[2px]", color)} />}
      {children}
    </span>
  );
}
