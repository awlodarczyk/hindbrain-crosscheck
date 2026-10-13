import type { SessionDetail } from "@/lib/api/sessions-dto";
import type { Call, Claim, Run, Session } from "@/lib/repos/types";
import { EMPTY_STATS } from "@/lib/repos/types";

export const makeSession = (over: Partial<Session> = {}): Session => ({
  id: "s1",
  userId: "u1",
  question: "Is the moon made of cheese?",
  title: null,
  mode: "ask",
  status: "done",
  settingsSnapshot: null,
  stats: { ...EMPTY_STATS },
  createdAt: "2026-10-12T14:32:00.000Z",
  updatedAt: "2026-10-12T14:33:00.000Z",
  deletedAt: null,
  ...over,
});

export const makeRun = (over: Partial<Run> = {}): Run => ({
  id: "r1",
  sessionId: "s1",
  attempt: 1,
  reason: "initial",
  status: "done",
  startedAt: "2026-10-12T14:32:00.000Z",
  finishedAt: null,
  ...over,
});

export const makeCall = (over: Partial<Call> = {}): Call => ({
  id: "c1",
  runId: "r1",
  kind: "answer",
  provider: "claude",
  transport: "mock",
  model: "claude-opus-5-5",
  status: "done",
  startedAt: null,
  finishedAt: null,
  durationMs: 12_400,
  searches: 1,
  inputTokens: null,
  outputTokens: null,
  costUsd: null,
  text: "text",
  html: "<p>text</p>",
  citations: [],
  errorCode: null,
  errorMessage: null,
  pasted: false,
  ...over,
});

export const makeClaim = (over: Partial<Claim> = {}): Claim => ({
  id: "k1",
  callId: "c3",
  idx: 0,
  claim: "The moon orbits Earth",
  verdict: "supported",
  note: "Confirmed by NASA",
  sourceUrl: "https://www.nasa.gov/moon",
  sourceTitle: "NASA Moon",
  ...over,
});

/** Two attempts; attempt 2 holds four calls and three claims. */
export const makeDetail = (): SessionDetail => ({
  session: makeSession(),
  runs: [makeRun(), makeRun({ id: "r2", attempt: 2 })],
  calls: [
    makeCall({ id: "old", runId: "r1" }),
    makeCall({
      id: "c1",
      runId: "r2",
      citations: [
        { title: "NASA", url: "https://www.nasa.gov/moon" },
        { title: "ESA", url: "https://esa.int/moon" },
      ],
    }),
    makeCall({
      id: "c2",
      runId: "r2",
      provider: "chatgpt",
      model: "gpt-5.5",
      citations: [{ title: "NASA again", url: "https://www.nasa.gov/moon" }],
    }),
    makeCall({ id: "c3", runId: "r2", kind: "review", provider: "chatgpt", model: "gpt-5.5" }),
    makeCall({ id: "c4", runId: "r2", kind: "review", provider: "claude" }),
  ],
  claims: [
    makeClaim({ id: "k1", callId: "c3", idx: 1 }),
    makeClaim({ id: "k0", callId: "c3", idx: 0, verdict: "disputed" }),
    makeClaim({ id: "k2", callId: "c4", idx: 0 }),
  ],
});
