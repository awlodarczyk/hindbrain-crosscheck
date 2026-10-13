import type { Call, Session } from "@/lib/repos/types";
import type { LatestView } from "./select-bundle";

/** The latest view's calls in display order: answers then reviews. */
export function viewCalls(view: LatestView): readonly Call[] {
  return [
    view.answers.claude,
    view.answers.chatgpt,
    view.reviews.chatgpt,
    view.reviews.claude,
  ].flatMap((c) => (c ? [c] : []));
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Hostname without a leading "www."; returns the input when it is not a URL. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Fixed locale so server and client render the same date text. */
const META_LOCALE = "en-GB";

function formatWhen(iso: string, locale: string, timeZone: string | undefined) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(d);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
  return `${date} · ${time}`;
}

function runningMeta(session: Session, view: LatestView, locale: string, timeZone?: string) {
  const time = formatWhen(session.createdAt, locale, timeZone).split(" · ").at(-1);
  const models = [view.answers.claude?.model, view.answers.chatgpt?.model]
    .filter(Boolean)
    .join(" vs ");
  const { callsDone, calls } = session.stats;
  return ["Running", `started ${time}`, models, `${callsDone} of ${calls || 4} calls done`]
    .filter(Boolean)
    .join(" · ");
}

/** "12 Oct 2026 · 14:32 · modelA vs modelB · 4 calls · 7 searches · 48 s". */
export function metaLine(
  session: Session,
  view: LatestView,
  locale = META_LOCALE,
  timeZone?: string,
): string {
  const calls = viewCalls(view);
  if (session.status === "queued" || session.status === "running") {
    return runningMeta(session, view, locale, timeZone);
  }
  const models = [view.answers.claude?.model, view.answers.chatgpt?.model]
    .filter(Boolean)
    .join(" vs ");
  const seconds = Math.round(calls.reduce((a, c) => a + (c.durationMs ?? 0), 0) / 1000);
  return [
    formatWhen(session.createdAt, locale, timeZone),
    models,
    plural(calls.length, "call"),
    plural(
      calls.reduce((a, c) => a + c.searches, 0),
      "search",
      "searches",
    ),
    `${seconds} s`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Short per-card status: "12.4 s · 1 search", "running", "failed", "pasted". */
export function callMeta(call: Call): string {
  if (call.pasted) return "pasted";
  if (call.status === "running" && call.searches > 0)
    return `running · ${plural(call.searches, "search", "searches")}`;
  if (call.status !== "done") return call.status === "skipped" ? "skipped" : call.status;
  const parts = [call.durationMs === null ? null : `${(call.durationMs / 1000).toFixed(1)} s`];
  if (call.searches > 0) parts.push(plural(call.searches, "search", "searches"));
  return parts.filter(Boolean).join(" · ");
}
