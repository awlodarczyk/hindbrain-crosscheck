"use client";

import { useState, type FormEvent } from "react";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  minLength: number;
  /** Trim surrounding whitespace before validating and submitting. */
  trim?: boolean;
  submitLabel: string;
  onSubmit: (value: string) => Promise<void>;
};

/** Password-type prompt; the typed value is dropped as soon as the dialog closes. */
export function SecretDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  minLength,
  trim = false,
  submitLabel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = (next: boolean) => {
    if (!next) {
      setValue("");
      setMessage(null);
    }
    onOpenChange(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const secret = trim ? value.trim() : value;
    if (secret.length < minLength) {
      setMessage(`Enter at least ${minLength} characters.`);
      return;
    }
    setPending(true);
    try {
      await onSubmit(secret);
      close(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoComplete="off"
            aria-label={label}
            aria-invalid={message !== null}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {message && (
            <p role="alert" className="text-[12px] text-status-disputed">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
