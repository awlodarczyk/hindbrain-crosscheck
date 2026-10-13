"use client";

import { Slider } from "@/components/ui/slider";

export type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

/** Labelled slider with a mono value readout. */
export function SliderRow({ label, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="flex w-56 items-center gap-3">
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
      />
      <span className="w-10 text-right font-mono text-[12px] text-text-primary">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
