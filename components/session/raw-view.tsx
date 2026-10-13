"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import type { SessionDetail } from "@/lib/api/sessions-dto";
import { PROVIDER_LABEL } from "@/lib/pipeline/prompts";
import { callMeta, viewCalls } from "./meta-line";
import { selectLatest } from "./select-bundle";

/** Unrendered text of every call, with an attempt selector when there are several runs. */
export function RawView({ detail }: { detail: SessionDetail }) {
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const view = selectLatest(detail, picked);
  const current = view.run?.attempt;
  return (
    <div className="flex flex-col gap-4">
      {view.attempts.length > 1 && current !== undefined && (
        <Segmented
          ariaLabel="Attempt"
          size="sm"
          value={String(current)}
          onChange={(v) => setPicked(Number(v))}
          options={view.attempts.map((a) => ({ value: String(a), label: `Attempt ${a}` }))}
        />
      )}
      {viewCalls(view).map((call) => (
        <section key={call.id} aria-label={`${call.provider} ${call.kind} raw`}>
          <h3 className="mb-2 font-mono text-[12px] text-text-secondary">
            {call.kind} · {PROVIDER_LABEL[call.provider]} · {call.model} · {call.status} ·{" "}
            {callMeta(call)}
          </h3>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-panel border border-border-default bg-bg-subtle p-3 font-mono text-[12px] text-text-primary">
            {call.text ?? call.errorMessage ?? ""}
          </pre>
        </section>
      ))}
    </div>
  );
}
