"use client";

import { MoreHorizontal } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/components/ui/ring";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import type { HistoryItem } from "./group-by-day";

export type RowMenuProps = {
  item: HistoryItem;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

/** Per-row actions: a hover/focus "more" button, inline rename, and confirmed delete. */
export function RowMenu({ item, onRename, onDelete }: RowMenuProps) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const keepFocus = useRef(false);
  const pick = (action: () => void) => () => {
    keepFocus.current = true;
    action();
  };

  return (
    <>
      {renaming && (
        <RenameField
          initial={item.question}
          onCancel={() => setRenaming(false)}
          onSave={(title) => {
            setRenaming(false);
            void onRename(item.id, title);
          }}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More actions"
            className={cn(
              "absolute right-2 top-3 inline-flex size-7 items-center justify-center rounded-control text-text-secondary opacity-0 transition-opacity duration-150 hover:bg-bg-muted hover:text-text-primary focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100",
              focusRing,
            )}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(e) => {
            if (!keepFocus.current) return;
            keepFocus.current = false;
            e.preventDefault();
          }}
        >
          <DropdownMenuItem onSelect={pick(() => setRenaming(true))}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            className="text-status-disputed"
            onSelect={pick(() => setConfirming(true))}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this session?"
        body="It disappears from history but stays in the database. You can restore it from Settings → Data."
        confirmLabel="Delete"
        danger
        onConfirm={() => onDelete(item.id)}
      />
    </>
  );
}

function RenameField({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const title = value.trim();
      if (title) onSave(title);
    }
  };
  return (
    <div className="absolute inset-0 z-10 flex items-center bg-bg-muted px-3">
      <Input
        autoFocus
        aria-label="Session title"
        maxLength={200}
        className="h-8"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onCancel}
      />
    </div>
  );
}
