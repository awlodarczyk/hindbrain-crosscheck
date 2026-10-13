import type { Session } from "@/lib/repos/types";
import type { HistoryItem } from "./group-by-day";

/** A full run is two answers plus two reviews. */
const PLANNED_CALLS = 4;

/** Sidebar row for a session; a live session with no stats yet reports the planned call count. */
export function toHistoryItem(session: Session): HistoryItem {
  const live = session.status === "queued" || session.status === "running";
  return {
    id: session.id,
    question: session.title ?? session.question,
    status: session.status,
    claims: session.stats.claims,
    disputed: session.stats.disputed,
    callsDone: session.stats.callsDone,
    callsTotal: session.stats.calls || (live ? PLANNED_CALLS : 0),
    createdAt: session.createdAt,
  };
}
