import { CircleAlert, CircleCheck, ListChecks } from "lucide-react";
import type { Session } from "@/lib/repos/types";
import { StatTile } from "./stat-tile";

/** Meta line, question heading and the three stat tiles. */
export function SessionHeader({ session, meta }: { session: Session; meta: string }) {
  const pending = session.status === "queued" || session.status === "running";
  const n = (v: number) => (pending ? null : v);
  return (
    <div className="flex flex-col gap-3">
      <p suppressHydrationWarning className="font-mono text-[12px] text-text-secondary">
        {meta}
      </p>
      <h1 className="text-2xl font-semibold text-text-primary">
        {session.title ?? session.question}
      </h1>
      <div className="flex flex-wrap gap-2">
        <StatTile icon={ListChecks} label="Claims checked" value={n(session.stats.claims)} />
        <StatTile
          icon={CircleCheck}
          label="Supported"
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
