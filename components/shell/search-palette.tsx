"use client";

import { useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import type { SearchHit } from "@/lib/repos/search";
import { renderSnippet } from "./render-snippet";

const DEBOUNCE_MS = 150;

type State = { status: "idle" | "loading" | "done" | "error"; hits: readonly SearchHit[] };
const IDLE: State = { status: "idle", hits: [] };

export type SearchPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
};

/** ⌘K dialog: debounced full-text session search; selecting a hit calls `onSelect` and closes. */
export function SearchPalette({ open, onOpenChange, onSelect }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>(IDLE);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setState(IDLE);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState(IDLE);
      return;
    }
    let stale = false;
    setState((s) => ({ ...s, status: "loading" }));
    const timer = setTimeout(() => {
      api
        .search(q)
        .then((hits) => !stale && setState({ status: "done", hits }))
        .catch(() => !stale && setState({ status: "error", hits: [] }));
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  const choose = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[20%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Search sessions</DialogTitle>
        <Command shouldFilter={false} label="Search sessions">
          <CommandInput placeholder="Search sessions…" value={query} onValueChange={setQuery} />
          <CommandList>
            <Status state={state} hasQuery={query.trim() !== ""} />
            {state.hits.map((hit) => (
              <CommandItem
                key={hit.id}
                value={hit.id}
                onSelect={() => choose(hit.id)}
                className="h-auto flex-col items-start gap-0.5 py-2"
              >
                <span className="w-full truncate font-medium">{hit.question}</span>
                <span className="w-full truncate text-[12px] text-text-secondary">
                  {renderSnippet(hit.snippet)}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Status({ state, hasQuery }: { state: State; hasQuery: boolean }) {
  if (!hasQuery) return null;
  if (state.status === "loading") {
    return <p className="py-6 text-center text-[13px] text-text-muted">Searching…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="py-6 text-center text-[13px] text-text-muted">Search failed. Try again.</p>
    );
  }
  return state.status === "done" ? <CommandEmpty>No sessions match</CommandEmpty> : null;
}
