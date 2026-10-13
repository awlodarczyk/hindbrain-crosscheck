import type { ProviderId, Verdict } from "@/lib/db/enums";
import type { Call, Citation, Claim, Run, Session } from "@/lib/repos/types";
import { PROVIDER_LABEL } from "./prompts";

export { PROVIDER_LABEL };

export type SessionBundle = {
  session: Session;
  runs: readonly Run[];
  calls: readonly Call[];
  claims: readonly Claim[];
};

export type RunView = {
  run: Run | null;
  answers: Record<ProviderId, Call | null>;
  reviews: Record<ProviderId, Call | null>;
  claimsByCall: Record<string, readonly Claim[]>;
};

const ORDER: readonly ProviderId[] = ["claude", "chatgpt"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FOOTER = "two models agreeing is not proof — open the sources.";

export function escapeMdCell(s: string): string {
  return s
    .replace(/\|/g, "\\|")
    .replace(/\s*[\r\n]+\s*/g, " ")
    .trim();
}

export function latestRunView(b: SessionBundle): RunView {
  const run = b.runs.reduce<Run | null>((m, r) => (m && m.attempt >= r.attempt ? m : r), null);
  const answers: Record<ProviderId, Call | null> = { claude: null, chatgpt: null };
  const reviews: Record<ProviderId, Call | null> = { claude: null, chatgpt: null };
  const claimsByCall: Record<string, readonly Claim[]> = {};
  for (const call of b.calls.filter((c) => run && c.runId === run.id)) {
    (call.kind === "answer" ? answers : reviews)[call.provider] = call;
    claimsByCall[call.id] = b.claims
      .filter((c) => c.callId === call.id)
      .sort((a, z) => a.idx - z.idx);
  }
  return { run, answers, reviews, claimsByCall };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const link = (c: Citation) => `[${c.title.replace(/[[\]]/g, "")}](${c.url})`;
const seconds = (ms: number) => `${Math.round(ms / 1000)} s`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function notAvailable(call: Call | null): string {
  return call?.status === "failed" && call.errorMessage
    ? `_Not available (failed: ${call.errorMessage})_`
    : "_Not available_";
}

function answerSection(p: ProviderId, call: Call | null): string {
  const head = `## ${PROVIDER_LABEL[p]} answer${call?.pasted ? " (pasted)" : ""}`;
  if (!call || call.status !== "done" || call.text === null)
    return `${head}\n\n${notAvailable(call)}`;
  const meta = [
    call.model,
    call.durationMs === null ? null : seconds(call.durationMs),
    `${call.searches} searches`,
  ];
  const sources = call.citations.length
    ? `\n\nSources:\n${call.citations.map((c) => `- ${link(c)}`).join("\n")}`
    : "";
  return `${head}\n\n_${meta.filter(Boolean).join(" · ")}_\n\n${call.text}${sources}`;
}

const pctEncode = (ch: string) =>
  `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`;

function claimRow(c: Claim): string {
  const source = c.sourceUrl
    ? link({
        title: escapeMdCell(c.sourceTitle ?? c.sourceUrl),
        url: c.sourceUrl.replace(/[()|\s]/g, pctEncode),
      })
    : "";
  return `| ${capital(c.verdict)} | ${escapeMdCell(c.claim)} | ${escapeMdCell(c.note ?? "")} | ${source} |`;
}

function reviewSection(
  author: ProviderId,
  target: ProviderId,
  call: Call | null,
  claims: readonly Claim[],
): string {
  const head = `## ${PROVIDER_LABEL[author]} checks ${PROVIDER_LABEL[target]}`;
  if (!call || call.status !== "done") return `${head}\n\n${notAvailable(call)}`;
  if (!claims.length) return `${head}\n\n_No claims extracted_`;
  const table = [
    "| Verdict | Claim | Note | Source |",
    "| --- | --- | --- | --- |",
    ...claims.map(claimRow),
  ];
  return `${head}\n\n${table.join("\n")}`;
}

function summaryLine(b: SessionBundle, v: RunView): string {
  const calls = Object.values({
    ...v.answers,
    ...Object.fromEntries(ORDER.map((p) => [`r${p}`, v.reviews[p]])),
  });
  const live = calls.filter((c): c is Call => c !== null);
  const models = ORDER.map((p) => v.answers[p]?.model)
    .filter(Boolean)
    .join(" vs ");
  const parts = [
    formatWhen(b.session.createdAt),
    models,
    `${live.length} calls`,
    `${live.reduce((a, c) => a + c.searches, 0)} searches`,
    seconds(live.reduce((a, c) => a + (c.durationMs ?? 0), 0)),
  ];
  return `_${parts.filter(Boolean).join(" · ")}_`;
}

function countLine(claims: readonly Claim[]): string {
  const n = (v: Verdict) => claims.filter((c) => c.verdict === v).length;
  return `**Claims checked:** ${claims.length} · **Supported:** ${n("supported")} · **Disputed:** ${n("disputed")} · **Partial:** ${n("partial")} · **Unverifiable:** ${n("unverifiable")}`;
}

function sourcesSection(calls: readonly (Call | null)[]): string {
  const unique = new Map<string, Citation>();
  for (const c of calls.flatMap((x) => x?.citations ?? []))
    if (!unique.has(c.url)) unique.set(c.url, c);
  const list = [...unique.values()].map((c) => `- ${link(c)}`).join("\n");
  return `## Sources\n\n${list || "_None_"}`;
}

export function buildMarkdownReport(
  b: SessionBundle,
  opts: { now?: Date; appName?: string } = {},
): string {
  const app = opts.appName ?? "hindbrain crosscheck";
  const v = latestRunView(b);
  const allClaims = Object.values(v.claimsByCall).flat();
  const [first, second] = ORDER;
  const review = (author: ProviderId, target: ProviderId) => {
    const call = v.reviews[author];
    return reviewSection(author, target, call, call ? (v.claimsByCall[call.id] ?? []) : []);
  };
  return (
    [
      `# ${b.session.title ?? b.session.question}`,
      summaryLine(b, v),
      countLine(allClaims),
      answerSection(first!, v.answers[first!]),
      review(second!, first!),
      answerSection(second!, v.answers[second!]),
      review(first!, second!),
      sourcesSection([...Object.values(v.answers), ...Object.values(v.reviews)]),
      `_Generated ${(opts.now ?? new Date()).toISOString()} by ${app} · ${FOOTER}_`,
    ].join("\n\n") + "\n"
  );
}
