"use client";

import { Segmented } from "@/components/ui/segmented";

/** Switches between asking both models and pasting existing answers. */
export function ModeToggle({
  value,
  onChange,
}: {
  value: "ask" | "paste";
  onChange: (v: "ask" | "paste") => void;
}) {
  return (
    <Segmented
      ariaLabel="Input mode"
      value={value}
      onChange={onChange}
      options={[
        { value: "ask", label: "Ask both models" },
        { value: "paste", label: "Paste existing answers" },
      ]}
    />
  );
}
