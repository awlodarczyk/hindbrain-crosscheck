import type { Call, Claim, Run, Session } from "@/lib/repos/types";
import type { SessionBundle } from "@/lib/pipeline/report";

const T0 = "2026-10-12T14:32:00.000Z";
const T1 = "2026-10-12T14:32:48.000Z";

const session: Session = {
  id: "s1",
  userId: "u1",
  question: "Does static stretching before training reduce injury risk?",
  transcript: null,
  title: null,
  mode: "ask",
  status: "done",
  settingsSnapshot: { depth: "standard" },
  stats: {
    claims: 7,
    supported: 5,
    disputed: 1,
    partial: 1,
    unverifiable: 0,
    calls: 4,
    callsDone: 4,
    searches: 7,
    durationMs: 48000,
    costUsd: 0.21,
  },
  createdAt: T0,
  updatedAt: T1,
  deletedAt: null,
};

const run: Run = {
  id: "r1",
  sessionId: "s1",
  attempt: 1,
  reason: "initial",
  status: "done",
  startedAt: T0,
  finishedAt: T1,
};

const baseCall: Call = {
  id: "",
  runId: "r1",
  kind: "answer",
  provider: "claude",
  transport: "anthropic-api",
  model: "claude-opus-5-5",
  status: "done",
  startedAt: T0,
  finishedAt: T1,
  durationMs: 20000,
  searches: 2,
  inputTokens: 1200,
  outputTokens: 640,
  costUsd: 0.05,
  text: null,
  html: null,
  citations: [],
  errorCode: null,
  errorMessage: null,
  pasted: false,
};

const calls: Call[] = [
  {
    ...baseCall,
    id: "c1",
    text: "Static stretching alone before training does not meaningfully reduce overall injury risk.",
    html: "<p>rendered</p>",
    citations: [
      { title: "Cochrane review on stretching", url: "https://example.org/cochrane-stretching" },
      { title: "BJSM warm-up meta-analysis", url: "https://example.org/bjsm-warmup" },
      { title: "Shrier 2004", url: "https://example.org/shrier-2004" },
    ],
  },
  {
    ...baseCall,
    id: "c2",
    provider: "chatgpt",
    transport: "openai-api",
    model: "gpt-5.5",
    text: "Evidence suggests pre-exercise static stretching has little effect on injury rates.",
    citations: [{ title: "BJSM warm-up meta-analysis", url: "https://example.org/bjsm-warmup" }],
    searches: 3,
  },
  {
    ...baseCall,
    id: "c3",
    kind: "review",
    provider: "chatgpt",
    transport: "openai-api",
    model: "gpt-5.5",
    text: "review",
    searches: 1,
  },
  { ...baseCall, id: "c4", kind: "review", model: "claude-opus-5-5", text: "review", searches: 1 },
];

const claim = (
  callId: string,
  idx: number,
  c: string,
  verdict: Claim["verdict"],
  extra: Partial<Claim> = {},
): Claim => ({
  id: `${callId}-${idx}`,
  callId,
  idx,
  claim: c,
  verdict,
  note: null,
  sourceUrl: null,
  sourceTitle: null,
  ...extra,
});

const claims: Claim[] = [
  claim("c3", 0, "Static stretching does not reduce overall injury risk.", "supported"),
  claim("c3", 1, "Dynamic warm-ups lower injury rates.", "supported"),
  claim("c3", 2, "Stretching reduces muscle strains | specifically.", "disputed", {
    note: "Effect seen only in sprinters,\nnot general athletes.",
    sourceUrl: "https://example.org/shrier-2004",
    sourceTitle: "Shrier 2004",
  }),
  claim("c4", 0, "Warm-up reduces injury risk.", "supported"),
  claim("c4", 1, "Stretching reduces power briefly.", "supported"),
  claim("c4", 2, "Evidence quality is moderate.", "supported"),
  claim("c4", 3, "Little effect on injury rates.", "partial", { note: "Depends on sport." }),
];

export const SESSION_BUNDLE: SessionBundle = Object.freeze({
  session,
  runs: [run],
  calls,
  claims,
});

export function makeBundle(overrides: Partial<SessionBundle> = {}): SessionBundle {
  return { ...SESSION_BUNDLE, ...overrides };
}
