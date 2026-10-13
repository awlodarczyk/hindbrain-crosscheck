"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SettingsView } from "@/lib/api/settings-dto";
import type { ProviderId } from "@/lib/db/enums";
import { SecretDialog } from "./secret-dialog";

const REVEAL_MS = 10_000;
const MIN_KEY_LENGTH = 20;
const PROVIDER_NAME: Record<ProviderId, string> = { claude: "Anthropic", chatgpt: "OpenAI" };

type State = SettingsView["secrets"][ProviderId];

function statusOf(s: State): { label: string; tone: BadgeTone } {
  if (s.source === "env") return { label: "Env", tone: "neutral" };
  if (s.source === "none") return { label: "Not set", tone: "neutral" };
  if (s.broken || s.valid === false) return { label: "Invalid", tone: "disputed" };
  if (s.valid === true) return { label: "Valid", tone: "supported" };
  return { label: "Set", tone: "neutral" };
}

function StatusBadge({ state }: { state: State }) {
  const { label, tone } = statusOf(state);
  if (state.source !== "env") return <Badge tone={tone}>{label}</Badge>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge tone={tone} tabIndex={0}>
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Set by environment variable; it overrides the stored key</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export type KeyFieldProps = {
  provider: ProviderId;
  state: State;
  onReplace: (apiKey: string) => Promise<void>;
  onReveal: (password?: string) => Promise<string>;
  onRemove: () => Promise<void>;
  /** Hosted mode asks for the account password before revealing. */
  requirePassword?: boolean;
};

/** Masked key display with status chip and reveal / replace / remove actions. */
export function KeyField({
  provider,
  state,
  onReplace,
  onReveal,
  onRemove,
  requirePassword,
}: KeyFieldProps) {
  const [plain, setPlain] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"replace" | "password" | "remove" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = PROVIDER_NAME[provider];

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setPlain(null);
  };
  const reveal = async (password?: string) => {
    const value = await onReveal(password);
    setPlain(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPlain(null), REVEAL_MS);
  };
  const onRevealClick = () => {
    if (plain !== null) return hide();
    if (requirePassword) return setDialog("password");
    reveal().catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Cannot reveal"));
  };

  const shown = plain ?? state.masked;
  return (
    <div
      role="group"
      aria-label={`${name} credentials`}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <span className="inline-flex h-8 min-w-40 max-w-64 items-center truncate rounded-control bg-bg-subtle px-3 font-mono text-[12px] text-text-primary">
        {shown ?? <span className="text-text-muted">—</span>}
      </span>
      <StatusBadge state={state} />
      <Button variant="secondary" disabled={state.masked === null} onClick={onRevealClick}>
        {plain === null ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {plain === null ? "Reveal" : "Hide"}
      </Button>
      <Button variant="secondary" onClick={() => setDialog("replace")}>
        Replace
      </Button>
      {state.source === "db" && (
        <Button variant="ghost" onClick={() => setDialog("remove")}>
          <Trash2 className="size-4" />
          Remove
        </Button>
      )}
      <SecretDialog
        open={dialog === "replace"}
        onOpenChange={(o) => setDialog(o ? "replace" : null)}
        title={`Replace ${name} key`}
        description="The key is encrypted before it is stored."
        label={`${name} API key`}
        minLength={MIN_KEY_LENGTH}
        trim
        submitLabel="Save"
        onSubmit={onReplace}
      />
      <SecretDialog
        open={dialog === "password"}
        onOpenChange={(o) => setDialog(o ? "password" : null)}
        title="Confirm your password"
        description={`Required to reveal the ${name} key.`}
        label="Account password"
        minLength={1}
        submitLabel="Reveal"
        onSubmit={reveal}
      />
      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={(o) => setDialog(o ? "remove" : null)}
        title={`Remove ${name} key?`}
        body="The stored key is deleted. An environment variable, if set, still applies."
        confirmLabel="Remove"
        danger
        onConfirm={onRemove}
      />
    </div>
  );
}
