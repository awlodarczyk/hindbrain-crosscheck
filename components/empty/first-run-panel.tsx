"use client";

import * as React from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import type { SettingsView } from "@/lib/api/settings-dto";
import type { ProviderId } from "@/lib/db/enums";
import { cn } from "@/lib/utils";

const CARDS = [
  { id: "claude", label: "CLAUDE", cli: "claude", name: "Claude Code", dot: "bg-model-claude" },
  { id: "chatgpt", label: "CHATGPT", cli: "codex", name: "Codex", dot: "bg-model-chatgpt" },
] as const;

/** Provider setup card shown until a provider can answer. */
export function FirstRunPanel({
  view,
  onUseCli,
}: {
  view: SettingsView;
  onUseCli: (p: ProviderId) => Promise<void>;
}) {
  const [busy, setBusy] = React.useState<ProviderId | null>(null);
  async function use(p: ProviderId) {
    setBusy(p);
    try {
      await onUseCli(p);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      aria-label="Connect a provider"
      className="w-full rounded-panel border border-border-default bg-bg-card p-5"
    >
      <h2 className="text-sm font-semibold text-text-primary">Connect a provider</h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        crosscheck needs at least one provider to answer. Use a CLI you already pay for, or paste an
        API key.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => {
          const info = view.cli[c.cli];
          const detected = view.cliAllowed && info.found;
          return (
            <div
              key={c.id}
              className="rounded-control border border-border-default bg-bg-subtle p-3.5"
            >
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                <span aria-hidden="true" className={cn("size-2", c.dot)} />
                {c.label}
              </div>
              <p
                className={cn(
                  "mt-2 text-[13px]",
                  detected ? "font-medium text-text-primary" : "text-text-muted",
                )}
              >
                {detected ? `${c.name} CLI detected` : "No CLI detected"}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-text-secondary">
                {detected
                  ? `${info.path ?? c.cli} · ${info.version ?? "unknown"}`
                  : `${c.cli} not found in PATH`}
              </p>
              {detected ? (
                <Button className="mt-3" disabled={busy !== null} onClick={() => void use(c.id)}>
                  Use {c.name} CLI
                </Button>
              ) : (
                <Link
                  href="/settings/models"
                  className={cn(buttonVariants({ variant: "secondary" }), "mt-3")}
                >
                  Enter API key
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        You can change this any time in Settings → Models.
      </p>
    </section>
  );
}
