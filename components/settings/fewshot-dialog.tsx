"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type FewShot = { question: string; answer: string };
export const MAX_EXAMPLES = 5;

type Keyed = FewShot & { id: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examples: readonly FewShot[];
  onSave: (examples: readonly FewShot[]) => void;
};

function Editor({
  examples,
  onSave,
  onCancel,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const nextId = useRef(examples.length);
  const [draft, setDraft] = useState<readonly Keyed[]>(() =>
    examples.map((e, i) => ({ ...e, id: i })),
  );
  const edit = (i: number, patch: Partial<FewShot>) =>
    setDraft(draft.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const complete = (): FewShot[] =>
    draft
      .filter((e) => e.question.trim() && e.answer.trim())
      .map(({ question, answer }) => ({ question, answer }));
  return (
    <>
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
        {draft.map((ex, i) => (
          <div
            key={ex.id}
            className="flex flex-col gap-2 rounded-control border border-border-default p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Question ${i + 1}`}
                placeholder="Question"
                maxLength={2000}
                value={ex.question}
                onChange={(e) => edit(i, { question: e.target.value })}
              />
              <Button
                variant="secondary"
                aria-label={`Remove example ${i + 1}`}
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              >
                <X className="size-4" />
              </Button>
            </div>
            <Textarea
              aria-label={`Answer ${i + 1}`}
              placeholder="Ideal answer"
              maxLength={4000}
              value={ex.answer}
              onChange={(e) => edit(i, { answer: e.target.value })}
            />
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        className="self-start"
        disabled={draft.length >= MAX_EXAMPLES}
        onClick={() => setDraft([...draft, { id: nextId.current++, question: "", answer: "" }])}
      >
        <Plus className="size-4" />
        Add example
      </Button>
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(complete())}>Save</Button>
      </DialogFooter>
    </>
  );
}

/** Dialog editing up to five question → answer pairs; the draft resets on every open. */
export function FewShotDialog({ open, onOpenChange, examples, onSave }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Few-shot examples</DialogTitle>
          <DialogDescription>
            Question and ideal answer pairs sent with every prompt.
          </DialogDescription>
        </DialogHeader>
        <Editor
          examples={examples}
          onCancel={() => onOpenChange(false)}
          onSave={(next) => {
            onSave(next);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
