"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { INSTRUCTIONS_TEMPLATE } from "@/lib/pipeline/templates";

const MAX_CHARS = 1000;
const count = new Intl.NumberFormat("en-US");

export type InstructionsTextareaProps = { value: string; onChange: (value: string) => void };

/** Custom-instructions field with a character counter and a template shortcut. */
export function InstructionsTextarea({ value, onChange }: InstructionsTextareaProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea
        aria-label="Custom instructions"
        rows={3}
        maxLength={MAX_CHARS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[12px] text-text-muted">
          {count.format(value.length)} / {count.format(MAX_CHARS)} characters
        </span>
        <Button variant="secondary" onClick={() => onChange(INSTRUCTIONS_TEMPLATE)}>
          Insert template
        </Button>
      </div>
    </div>
  );
}
