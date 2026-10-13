import type { CallKind, ProviderId, SessionStatus } from "@/lib/db/enums";
import type { SessionStats } from "@/lib/repos/types";

/** Live progress events emitted by the run pipeline, in emission order per call. */
export type RunEvent =
  | { type: "run.started"; sessionId: string; runId: string; attempt: number }
  | {
      type: "call.started";
      sessionId: string;
      callId: string;
      kind: CallKind;
      provider: ProviderId;
      model: string;
    }
  | {
      type: "call.progress";
      sessionId: string;
      callId: string;
      phase: "searching" | "writing";
      searches: number;
    }
  | {
      type: "call.done";
      sessionId: string;
      callId: string;
      durationMs: number;
      searches: number;
      claims?: number;
    }
  | { type: "call.failed"; sessionId: string; callId: string; code: string; message: string }
  | { type: "call.skipped"; sessionId: string; callId: string; reason: string }
  | { type: "session.stats"; sessionId: string; stats: SessionStats; status: SessionStatus }
  | { type: "session.done"; sessionId: string; status: SessionStatus; disputed: number };

export type EmitFn = (e: RunEvent) => void;
