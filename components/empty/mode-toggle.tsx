"use client";

import { Segmented } from "@/components/ui/segmented";
import type { SessionMode } from "@/lib/db/enums";

/** Switches between asking both models, pasting existing answers and importing a transcript. */
export function ModeToggle({
  value,
  onChange,
}: {
  value: SessionMode;
  onChange: (v: SessionMode) => void;
}) {
  return (
    <Segmented
      ariaLabel="Input mode"
      value={value}
      onChange={onChange}
      options={[
        { value: "ask", label: "Ask both models" },
        { value: "paste", label: "Paste existing answers" },
        { value: "transcript", label: "Import a transcript" },
      ]}
    />
  );
}
