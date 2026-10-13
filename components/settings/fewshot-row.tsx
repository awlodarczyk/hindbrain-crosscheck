"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FewShotDialog, type FewShot } from "./fewshot-dialog";

export type FewShotRowProps = {
  examples: readonly FewShot[];
  onChange: (next: readonly FewShot[]) => void;
};

/** Example count summary plus the editor dialog trigger. */
export function FewShotRow({ examples, onChange }: FewShotRowProps) {
  const [open, setOpen] = useState(false);
  const n = examples.length;
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[12px] text-text-secondary">
        {n === 0 ? "No examples" : `${n} ${n === 1 ? "example" : "examples"}`}
      </span>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" />
        Edit examples
      </Button>
      <FewShotDialog open={open} onOpenChange={setOpen} examples={examples} onSave={onChange} />
    </div>
  );
}
