"use client";

import type { ClipboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { TRANSCRIPT_MAX } from "@/lib/api/sessions-dto";
import { normalizeTranscript } from "@/lib/transcript/normalize";

/** One transcript textarea with a character counter and a text/JSON file picker. */
export function TranscriptField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const accept = (raw: string) => onChange(normalizeTranscript(raw).slice(0, TRANSCRIPT_MAX));
  function paste(e: ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const { value: current, selectionStart, selectionEnd } = e.currentTarget;
    const pasted = e.clipboardData.getData("text");
    accept(current.slice(0, selectionStart) + pasted + current.slice(selectionEnd));
  }
  async function pick(file: File | undefined) {
    if (file) accept(await file.text());
  }
  return (
    <div className="flex flex-col gap-1 px-4 pb-3">
      <label htmlFor="transcript" className="text-xs font-medium text-text-secondary">
        Chat transcript
      </label>
      <Textarea
        id="transcript"
        rows={10}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, TRANSCRIPT_MAX))}
        onPaste={paste}
        placeholder="Paste the whole conversation here (user and assistant turns, any format)"
        className="text-[13px]"
      />
      <div className="flex items-center justify-between gap-3 text-[11px] text-text-muted">
        <label className="cursor-pointer underline-offset-2 hover:underline">
          Load a .txt / .md / .json file
          <input
            type="file"
            accept=".txt,.md,.markdown,.json,text/plain,application/json"
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
        <span className="font-mono">
          {value.length.toLocaleString("en-US")} / {TRANSCRIPT_MAX.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}
