"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Row } from "./section";

type Props = {
  title: string;
  sub: string;
  buttonLabel: string;
  confirmTitle: string;
  confirmBody: string;
  confirmWord: string;
  onConfirm: () => Promise<void>;
};

/** Destructive action gated behind a typed-word confirmation. */
export function DangerRow({
  buttonLabel,
  confirmTitle,
  confirmBody,
  confirmWord,
  onConfirm,
  ...row
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Row {...row}>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
        {buttonLabel}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmTitle}
        body={confirmBody}
        confirmLabel={buttonLabel}
        confirmWord={confirmWord}
        danger
        onConfirm={onConfirm}
      />
    </Row>
  );
}
