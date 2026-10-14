import { CircleAlert, CircleCheck, ListChecks } from "lucide-react";
import type { Session } from "@/lib/repos/types";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "./stat-tile";
import { TranscriptView } from "./transcript-view";

/** Meta line, question heading and the three stat tiles. */
export function SessionHeader({ session, meta }: { session: Session; meta: string }) {
  const pending = session.status === "queued" || session.status === "running";
  const n = (v: number) => (pending ? null : v);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p
          suppressHydrationWarning
          className="break-words font-mono text-[12px] text-text-secondary"
        >
          {meta}
        </p>
        {session.mode === "transcript" && <Badge>Transcript</Badge>}
      </div>
      <h1 className="text-xl font-semibold md:text-2xl text-text-primary">
        {session.title ?? session.question}
      </h1>
      {session.transcript !== null && (
        <details className="rounded-panel border border-border-default bg-bg-subtle text-sm">
          <summary className="cursor-pointer px-4 py-2 font-medium text-text-secondary">
            Imported transcript · focus: {session.question}
          </summary>
          <TranscriptView text={session.transcript} />
        </details>
      )}
      <div className="flex gap-2">
        <StatTile
          icon={ListChecks}
          label="Claims checked"
          shortLabel="Claims"
          value={n(session.stats.claims)}
        />
        <StatTile
          icon={CircleCheck}
          label="Supported"
          shortLabel="OK"
          value={n(session.stats.supported)}
          tone="supported"
        />
        <StatTile
          icon={CircleAlert}
          label="Disputed"
          value={n(session.stats.disputed)}
          tone="disputed"
        />
      </div>
    </div>
  );
}
