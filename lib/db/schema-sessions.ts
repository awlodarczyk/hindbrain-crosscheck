import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  CallKind,
  CallStatus,
  ProviderId,
  RunReason,
  RunStatus,
  SessionMode,
  SessionStatus,
  Transport,
  Verdict,
} from "./enums";
import { users } from "./schema-auth";

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    question: text("question").notNull(),
    title: text("title"),
    mode: text("mode").$type<SessionMode>().notNull(),
    status: text("status").$type<SessionStatus>().notNull(),
    settingsSnapshot: text("settings_snapshot").notNull(),
    stats: text("stats").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("sessions_user_idx").on(t.userId, t.deletedAt, t.createdAt)],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    reason: text("reason").$type<RunReason>().notNull(),
    status: text("status").$type<RunStatus>().notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
  },
  (t) => [index("runs_session_idx").on(t.sessionId)],
);

export const calls = sqliteTable(
  "calls",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    kind: text("kind").$type<CallKind>().notNull(),
    provider: text("provider").$type<ProviderId>().notNull(),
    transport: text("transport").$type<Transport>().notNull(),
    model: text("model").notNull(),
    status: text("status").$type<CallStatus>().notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    durationMs: integer("duration_ms"),
    searches: integer("searches").notNull().default(0),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: real("cost_usd"),
    text: text("text"),
    html: text("html"),
    citations: text("citations").notNull().default("[]"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    pasted: integer("pasted", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("calls_run_idx").on(t.runId)],
);

export const claims = sqliteTable(
  "claims",
  {
    id: text("id").primaryKey(),
    callId: text("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    claim: text("claim").notNull(),
    verdict: text("verdict").$type<Verdict>().notNull(),
    note: text("note"),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
  },
  (t) => [index("claims_call_idx").on(t.callId, t.idx)],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    ts: text("ts").notNull(),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
  },
  (t) => [index("events_session_ts_idx").on(t.sessionId, t.ts)],
);
