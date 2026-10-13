/** Turns free text into an FTS5 MATCH expression: each whitespace token becomes a quoted phrase (implicit AND). Blank input yields "". */
export function escapeFtsQuery(q: string): string {
  return q
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replaceAll('"', '""')}"`)
    .join(" ");
}
