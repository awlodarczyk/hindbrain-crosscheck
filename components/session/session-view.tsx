"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/shell/topbar";
import { Kbd } from "@/components/ui/kbd";
import { api } from "@/lib/api/client";
import type { SessionDetail } from "@/lib/api/sessions-dto";
import type { SettingsView } from "@/lib/api/settings-dto";
import { Composer, type ComposerSubmit } from "./composer";
import { SessionHeader } from "./header";
import { metaLine } from "./meta-line";
import { selectLatest } from "./select-bundle";
import { SessionActions } from "./session-actions";
import { SessionTabs } from "./tabs";
import { useSessionPoll } from "./use-session-poll";

export type SessionViewProps = {
  initial: SessionDetail;
  settings: SettingsView["settings"];
  models: SettingsView["models"];
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? "Today"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The session screen: header, tabs, actions and the docked composer. */
export function SessionView({ initial, settings, models }: SessionViewProps) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const { polling, start } = useSessionPoll(initial.session.id, setDetail);
  const view = useMemo(() => selectLatest(detail), [detail]);
  const { session } = detail;
  const busy = polling || session.status === "queued" || session.status === "running";

  const rerun = useCallback(async () => {
    await api.sessions.rerun(session.id);
    start(detail.runs.length + 1);
  }, [session.id, detail.runs.length, start]);

  const retry = useCallback(
    async (callId: string) => {
      try {
        await api.sessions.retry(session.id, callId);
        start(detail.runs.length);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [session.id, detail.runs.length, start],
  );

  async function ask(input: ComposerSubmit) {
    try {
      const { id } = await api.sessions.create(input);
      router.push(`/s/${id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        crumbs={[
          { label: "History", href: "/" },
          { label: dayLabel(session.createdAt) },
          { label: session.title ?? session.question },
        ]}
        actions={
          <>
            <span className="hidden items-center gap-1.5 text-xs text-text-muted sm:flex">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd>
              navigate
            </span>
            <SessionActions detail={detail} busy={busy} onRerun={rerun} />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-6 md:px-8">
        <SessionHeader session={session} meta={metaLine(session, view)} />
        <SessionTabs detail={detail} view={view} onRetry={(id) => void retry(id)} />
      </div>
      <div className="sticky bottom-0 mt-6 border-t border-border-default bg-bg-page px-4 py-3 md:px-8">
        <Composer
          variant="docked"
          settings={settings}
          models={models}
          disabled={busy}
          disabledLabel="Wait for this run to finish"
          onSubmit={ask}
        />
      </div>
    </div>
  );
}
