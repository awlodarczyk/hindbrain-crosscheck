"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { PasteFields, type Pasted } from "@/components/empty/paste-fields";
import { TranscriptField } from "@/components/empty/transcript-field";
import { Button } from "@/components/ui/button";
import { useMedia } from "@/components/shell/use-media";
import { Kbd } from "@/components/ui/kbd";
import type { SettingsView } from "@/lib/api/settings-dto";
import type { ProviderId, SessionMode } from "@/lib/db/enums";
import type { Settings } from "@/lib/settings/schema";
import { cn } from "@/lib/utils";
import { ModelChip } from "./model-chip";
import { SearchesChip } from "./searches-chip";

export type ComposerSubmit = {
  question: string;
  mode: SessionMode;
  pasted?: { claude?: string; chatgpt?: string };
  transcript?: string;
  overrides?: {
    providers?: { claude?: { answerModel?: string }; chatgpt?: { answerModel?: string } };
    cost?: { maxSearchesPerCall?: number };
  };
};

export type ComposerProps = {
  variant: "centered" | "docked";
  settings: Settings;
  models: SettingsView["models"];
  disabled?: boolean;
  disabledLabel?: string;
  /** Textarea placeholder shown while `disabled`. */
  disabledPlaceholder?: string;
  busy?: boolean;
  mode?: SessionMode;
  /** Stored transcript of the current session; when set, the docked composer asks follow-ups about it. */
  followUpTranscript?: string | null;
  onSubmit: (input: ComposerSubmit) => Promise<void>;
};

const PROVIDERS: readonly ProviderId[] = ["claude", "chatgpt"];
const PLACEHOLDER = "e.g. Does static stretching before training reduce injury risk?";
const DOCKED_PLACEHOLDER = "Ask a new question…";
const FOLLOW_UP_PLACEHOLDER = "Ask a follow-up about this transcript…";
const TRANSCRIPT_PLACEHOLDER = "What should the models focus on? (optional)";
const MAX_ROWS = 8;
const LINE_PX = 21;

function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  rows: number,
) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS * LINE_PX + 16)}px`;
  }, [ref, value, rows]);
}

/** Question input with model/search chips and a submit button; `centered` is the 720 px card, `docked` a single row. */
export function Composer(props: ComposerProps) {
  const {
    variant,
    settings,
    models,
    disabled,
    disabledLabel,
    disabledPlaceholder,
    busy,
    mode = "ask",
    followUpTranscript,
    onSubmit,
  } = props;
  const docked = variant === "docked";
  const [question, setQuestion] = React.useState("");
  const [pasted, setPasted] = React.useState<Pasted>({ claude: "", chatgpt: "" });
  const [transcript, setTranscript] = React.useState("");
  const [picked, setPicked] = React.useState<Partial<Record<ProviderId, string>>>({});
  const [searches, setSearches] = React.useState(settings.cost.maxSearchesPerCall);
  const [pending, setPending] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const inflight = React.useRef(false);
  const narrow = useMedia("(max-width: 768px)");
  useAutoGrow(ref, question, docked ? 1 : 3);

  const paste = mode === "paste" && !docked;
  const imported = mode === "transcript" && !docked;
  const followUp = docked && followUpTranscript ? followUpTranscript : null;
  const hasPaste = pasted.claude.trim() !== "" || pasted.chatgpt.trim() !== "";
  const ready = imported
    ? transcript.trim() !== ""
    : question.trim() !== "" && (!paste || hasPaste);
  const compact = docked && narrow;
  const blocked = disabled || busy || pending;

  async function submit() {
    if (!ready || blocked || inflight.current) return;
    inflight.current = true;
    setPending(true);
    try {
      await onSubmit(buildInput());
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }

  function buildInput(): ComposerSubmit {
    const providers = Object.fromEntries(
      PROVIDERS.filter((p) => picked[p] && picked[p] !== settings.providers[p].answerModel).map(
        (p) => [p, { answerModel: picked[p] }],
      ),
    );
    const cost =
      searches !== settings.cost.maxSearchesPerCall ? { maxSearchesPerCall: searches } : undefined;
    const overrides = {
      ...(Object.keys(providers).length ? { providers } : {}),
      ...(cost ? { cost } : {}),
    };
    return {
      question: question.trim(),
      mode: paste ? "paste" : imported || followUp ? "transcript" : "ask",
      ...(followUp ? { transcript: followUp } : {}),
      ...(paste ? { pasted: pastedPayload(pasted) } : {}),
      ...(imported ? { transcript: transcript.trim() } : {}),
      ...(Object.keys(overrides).length ? { overrides } : {}),
    };
  }

  const chips = (
    <div className="flex flex-wrap items-center gap-2">
      {PROVIDERS.map((p) => (
        <ModelChip
          key={p}
          provider={p}
          model={picked[p] ?? settings.providers[p].answerModel}
          options={models[p]}
          disabled={blocked}
          onChange={(m) => setPicked((s) => ({ ...s, [p]: m }))}
        />
      ))}
      <SearchesChip value={searches} onChange={setSearches} disabled={blocked} />
    </div>
  );

  const sendLabel = "Ask & cross-check";
  const roundSend = (
    <Button
      type="button"
      aria-label={sendLabel}
      disabled={!ready || blocked}
      onClick={() => void submit()}
      className="size-11 shrink-0 rounded-full p-0"
    >
      <ArrowUp aria-hidden="true" className="size-5" />
    </Button>
  );

  const action = (
    <div className="flex shrink-0 items-center gap-2">
      <span className="hidden items-center gap-1 sm:flex" aria-hidden="true">
        <Kbd>⌘</Kbd>
        <Kbd>↵</Kbd>
      </span>
      <Button
        type="button"
        disabled={!ready || blocked}
        onClick={() => void submit()}
        className="gap-1.5"
      >
        {disabled && disabledLabel ? disabledLabel : sendLabel}
        {!(disabled && disabledLabel) && <ArrowUp aria-hidden="true" className="size-3.5" />}
      </Button>
    </div>
  );

  const placeholder =
    disabled && disabledPlaceholder
      ? disabledPlaceholder
      : docked
        ? followUp
          ? FOLLOW_UP_PLACEHOLDER
          : DOCKED_PLACEHOLDER
        : imported
          ? TRANSCRIPT_PLACEHOLDER
          : PLACEHOLDER;

  const input = (
    <textarea
      ref={ref}
      aria-label="Question"
      rows={docked ? 1 : 3}
      value={question}
      disabled={blocked}
      placeholder={placeholder}
      onChange={(e) => setQuestion(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
      maxLength={8000}
      className={cn(
        "w-full resize-none bg-transparent text-base text-text-primary md:text-sm outline-none placeholder:text-text-muted",
        docked ? "min-w-0 flex-1 py-3 md:py-4" : "px-4 pt-4",
        compact && "px-4",
      )}
    />
  );

  if (compact) {
    return (
      <div
        data-variant="docked"
        className="flex items-center gap-2 border-t border-border-default bg-bg-card px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-full border border-border-default bg-bg-subtle">
          {input}
        </div>
        {roundSend}
      </div>
    );
  }
  if (docked) {
    return (
      <div
        data-variant="docked"
        className="flex min-h-14 items-center gap-3 border-t border-border-default bg-bg-card px-4"
      >
        {chips}
        {input}
        {action}
      </div>
    );
  }
  return (
    <div
      data-variant="centered"
      className="w-full rounded-panel border border-border-default bg-bg-card focus-within:border-accent-default focus-within:shadow-[0_0_0_1px_var(--accent-default)]"
    >
      {input}
      {paste && <PasteFields value={pasted} onChange={setPasted} />}
      {imported && <TranscriptField value={transcript} onChange={setTranscript} />}
      <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
        {chips}
        {action}
      </div>
    </div>
  );
}

function pastedPayload(p: Pasted): { claude?: string; chatgpt?: string } {
  return {
    ...(p.claude.trim() ? { claude: p.claude } : {}),
    ...(p.chatgpt.trim() ? { chatgpt: p.chatgpt } : {}),
  };
}
