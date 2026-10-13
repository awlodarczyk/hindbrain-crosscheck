"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProviderId } from "@/lib/db/enums";

const SAME = "__same__";
const DOT: Record<ProviderId, string> = { claude: "bg-model-claude", chatgpt: "bg-model-chatgpt" };

export type ModelSelectProps = {
  provider: ProviderId;
  label: string;
  value: string | null;
  models: readonly { id: string; label: string }[];
  /** Adds a "same as answer model" option that maps to null. */
  allowSame?: boolean;
  onChange: (value: string | null) => void;
};

/** Model picker showing a provider dot and the mono model id. */
export function ModelSelect({
  provider,
  label,
  value,
  models,
  allowSame,
  onChange,
}: ModelSelectProps) {
  return (
    <Select value={value ?? SAME} onValueChange={(v) => onChange(v === SAME ? null : v)}>
      <SelectTrigger aria-label={label} className="w-44 font-mono text-[12px]">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={`size-2 shrink-0 ${DOT[provider]}`} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {allowSame && <SelectItem value={SAME}>same as answer model</SelectItem>}
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id} className="font-mono text-[12px]">
            {m.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
