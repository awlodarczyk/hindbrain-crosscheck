import type { ReactNode } from "react";

const MARKED = /<mark>([^]*?)<\/mark>/g;

/** Renders an FTS snippet: balanced `<mark>` pairs become highlights, everything else is literal text. */
export function renderSnippet(snippet: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of snippet.matchAll(MARKED)) {
    const at = m.index ?? 0;
    if (at > last) out.push(snippet.slice(last, at));
    out.push(
      <mark key={at} className="rounded-[2px] bg-bg-selected px-0.5 text-text-primary">
        {m[1]}
      </mark>,
    );
    last = at + m[0].length;
  }
  if (last < snippet.length) out.push(snippet.slice(last));
  return out;
}
