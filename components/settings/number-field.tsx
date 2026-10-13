"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
};

/** Integer input that commits only in-range values and snaps back on blur. */
export function NumberField({ label, value, min, max, onChange, suffix }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const valid = (n: number) => Number.isInteger(n) && n >= min && n <= max;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        className="w-20"
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && valid(n)) onChange(n);
        }}
        onBlur={() => setDraft(null)}
      />
      {suffix && <span className="text-[13px] text-text-secondary">{suffix}</span>}
    </span>
  );
}
