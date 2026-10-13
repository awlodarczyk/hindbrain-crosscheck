import { Textarea } from "@/components/ui/textarea";

export const PASTE_MAX = 200_000;
export type Pasted = { claude: string; chatgpt: string };

const FIELDS = [
  { key: "claude", label: "Claude's answer" },
  { key: "chatgpt", label: "ChatGPT's answer" },
] as const;

/** Two answer textareas with character counters; at least one must be filled to submit. */
export function PasteFields({ value, onChange }: { value: Pasted; onChange: (v: Pasted) => void }) {
  return (
    <div className="grid gap-3 px-4 pb-3 sm:grid-cols-2">
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1">
          <label htmlFor={`paste-${key}`} className="text-xs font-medium text-text-secondary">
            {label}
          </label>
          <Textarea
            id={`paste-${key}`}
            rows={5}
            maxLength={PASTE_MAX}
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            placeholder="Paste the answer here"
            className="text-[13px]"
          />
          <span className="text-right font-mono text-[11px] text-text-muted">
            {value[key].length.toLocaleString("en-US")} / {PASTE_MAX.toLocaleString("en-US")}
          </span>
        </div>
      ))}
    </div>
  );
}
