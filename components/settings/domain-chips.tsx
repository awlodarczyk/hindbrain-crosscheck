"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
const MAX_DOMAINS = 20;

export type DomainChipsProps = {
  domains: readonly string[];
  onChange: (next: readonly string[]) => void;
};

/** Removable domain chips with an inline add input (Enter adds, Escape cancels). */
export function DomainChips({ domains, onChange }: DomainChipsProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAdding(false);
    setDraft("");
    setError(null);
  };
  const commit = () => {
    const value = draft.trim().toLowerCase();
    if (!DOMAIN.test(value)) return setError("Enter a domain like nih.gov");
    if (!domains.includes(value)) onChange([...domains, value]);
    close();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {domains.map((d) => (
        <span
          key={d}
          className="inline-flex h-6 items-center gap-1 rounded-control border border-border-default bg-bg-subtle pl-2 pr-1 font-mono text-[12px] text-text-primary"
        >
          {d}
          <button
            type="button"
            aria-label={`Remove ${d}`}
            className="inline-flex size-4 cursor-pointer items-center justify-center rounded-control text-text-secondary hover:text-text-primary"
            onClick={() => onChange(domains.filter((x) => x !== d))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <span className="flex flex-col gap-1">
          <Input
            autoFocus
            aria-label="Domain"
            aria-invalid={error !== null}
            className="h-7 w-44 font-mono text-[12px]"
            placeholder="nih.gov"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") close();
            }}
          />
          {error && (
            <span role="alert" className="text-[12px] text-status-disputed">
              {error}
            </span>
          )}
        </span>
      ) : (
        <Button
          variant="secondary"
          disabled={domains.length >= MAX_DOMAINS}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" />
          Add domain
        </Button>
      )}
    </div>
  );
}
