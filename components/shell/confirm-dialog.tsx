"use client";

import { useState, type ReactNode } from "react";
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

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** When set, the user must type this exact word before Confirm enables. */
  confirmWord?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
};

/** Modal confirmation with optional typed-word guard; Confirm is disabled while pending. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  confirmWord,
  danger,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const blocked = pending || (confirmWord !== undefined && typed !== confirmWord);

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {confirmWord !== undefined && (
          <Input
            aria-label={`Type ${confirmWord} to confirm`}
            placeholder={confirmWord}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} disabled={blocked} onClick={confirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
