import { Badge } from "@/components/ui/badge";
import { PROVIDER_LABEL } from "@/lib/pipeline/prompts";
import type { Call } from "@/lib/repos/types";
import { uniqueSources } from "./select-bundle";

/** Unique cited urls with the cards that cited each. */
export function SourcesList({ calls }: { calls: readonly Call[] }) {
  const sources = uniqueSources(calls);
  if (sources.length === 0)
    return <p className="text-[13px] text-text-secondary">No sources cited.</p>;
  return (
    <ul className="rounded-panel border border-border-default bg-bg-card">
      {sources.map((s) => (
        <li
          key={s.url}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default px-4 py-3 last:border-0"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-text-primary">{s.title}</p>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate font-mono text-[12px] text-text-muted hover:text-text-primary hover:underline"
            >
              {s.url}
            </a>
          </div>
          <div className="flex gap-1">
            {s.citedBy.map((b) => (
              <Badge key={`${b.kind}-${b.provider}`} tone="neutral" className="h-5">
                {PROVIDER_LABEL[b.provider]} {b.kind}
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
