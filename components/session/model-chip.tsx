import { ChevronDown } from "lucide-react";
import type { ProviderId } from "@/lib/db/enums";
import { focusRing } from "@/components/ui/ring";
import { cn } from "@/lib/utils";

export const chipClass =
  "relative inline-flex h-7 items-center gap-1.5 rounded-control border border-border-default bg-bg-subtle px-2 font-mono text-xs text-text-primary";

const DOT: Record<ProviderId, string> = { claude: "bg-model-claude", chatgpt: "bg-model-chatgpt" };
const NAME: Record<ProviderId, string> = { claude: "Claude", chatgpt: "ChatGPT" };

export type ModelChipProps = {
  provider: ProviderId;
  model: string;
  options: readonly { id: string; label: string }[];
  onChange: (model: string) => void;
  disabled?: boolean;
};

/** Chip showing a provider's model; a native select overlays it for choosing another. */
export function ModelChip({ provider, model, options, onChange, disabled }: ModelChipProps) {
  const known = options.some((o) => o.id === model);
  return (
    <span
      className={cn(
        chipClass,
        "focus-within:ring-2 focus-within:ring-accent-default",
        disabled && "opacity-50",
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", DOT[provider])} />
      <span aria-hidden="true">{model}</span>
      <ChevronDown aria-hidden="true" className="size-3.5 text-text-muted" />
      <select
        aria-label={`${NAME[provider]} model`}
        value={model}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn("absolute inset-0 cursor-pointer opacity-0", focusRing)}
      >
        {!known && <option value={model}>{model}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
