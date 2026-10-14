import { z } from "zod";
import type { HistoryItem } from "@/components/shell/group-by-day";
import type { Db } from "@/lib/db/client";
import { TRANSCRIPT_DEFAULT_QUESTION } from "@/lib/pipeline/prompts";
import { listCallsForSession } from "@/lib/repos/calls";
import { listClaimsForCalls } from "@/lib/repos/claims";
import { listRuns } from "@/lib/repos/runs";
import { getSession } from "@/lib/repos/sessions";
import type { Call, Claim, Run, Session } from "@/lib/repos/types";
import { normalizeTranscript } from "@/lib/transcript/normalize";

const modelOverride = z.object({ answerModel: z.string().optional() }).partial().optional();

export const TRANSCRIPT_MAX = 200_000;
export const TRANSCRIPT_RAW_MAX = 500_000;

const CreateSessionSchema = z
  .object({
    question: z.string().trim().max(8000).default(""),
    mode: z.enum(["ask", "paste", "transcript"]).default("ask"),
    transcript: z
      .string()
      .max(TRANSCRIPT_RAW_MAX)
      .transform((s) => normalizeTranscript(s))
      .pipe(z.string().trim().max(TRANSCRIPT_MAX))
      .optional(),
    pasted: z
      .object({
        claude: z.string().max(200_000).optional(),
        chatgpt: z.string().max(200_000).optional(),
      })
      .optional(),
    overrides: z
      .object({
        providers: z.object({ claude: modelOverride, chatgpt: modelOverride }).partial().optional(),
        cost: z
          .object({ maxSearchesPerCall: z.number().int().min(0).max(20).optional() })
          .partial()
          .optional(),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "transcript" && !v.transcript) {
      ctx.addIssue({ code: "custom", path: ["transcript"], message: "Paste a transcript." });
    }
    if (v.mode !== "transcript" && v.question === "") {
      ctx.addIssue({ code: "custom", path: ["question"], message: "Ask a question." });
    }
    if (v.mode !== "paste") return;
    const any = [v.pasted?.claude, v.pasted?.chatgpt].some((t) => (t ?? "").trim() !== "");
    if (!any) {
      ctx.addIssue({
        code: "custom",
        path: ["pasted"],
        message: "Paste at least one answer.",
      });
    }
  })
  .transform((v) => ({ ...v, question: v.question || TRANSCRIPT_DEFAULT_QUESTION }));
export type CreateSessionInput = z.output<typeof CreateSessionSchema>;
export const CreateSessionBody = CreateSessionSchema;

/** Wire form of the list cursor: `<createdAt>|<id>`. */
const BeforeSchema = z
  .string()
  .regex(/^[^|]+\|[^|]+$/, "before must be <createdAt>|<id>")
  .transform((v) => {
    const [createdAt = "", id = ""] = v.split("|");
    return { createdAt, id };
  });

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: BeforeSchema.optional(),
});

export type ListQueryInput = z.output<typeof ListQuerySchema>;
export const ListQuery = ListQuerySchema;

export const RenameBody = z.object({ title: z.string().trim().min(1).max(200) });
export const DeleteAllBody = z.object({ confirm: z.literal("DELETE") });

export type SessionListItem = HistoryItem;
export type SessionDetail = {
  session: Session;
  runs: readonly Run[];
  calls: readonly Call[];
  claims: readonly Claim[];
};

export function toListItem(s: Session): SessionListItem {
  return {
    id: s.id,
    question: s.title ?? s.question,
    status: s.status,
    claims: s.stats.claims,
    disputed: s.stats.disputed,
    callsDone: s.stats.callsDone,
    callsTotal: s.stats.calls,
    createdAt: s.createdAt,
    mode: s.mode,
  };
}

export function loadBundle(db: Db, userId: string, id: string): SessionDetail | null {
  const session = getSession(db, userId, id);
  if (!session) return null;
  const calls = listCallsForSession(db, id);
  return {
    session,
    runs: listRuns(db, id),
    calls,
    claims: listClaimsForCalls(
      db,
      calls.map((c) => c.id),
    ),
  };
}
