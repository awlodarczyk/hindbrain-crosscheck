"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { toHistoryItem } from "@/components/shell/history-item";
import { useSessionListActions } from "@/components/shell/session-list-context";
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
import { useSessionEvents } from "./use-session-events";

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
  const { upsert } = useSessionListActions();
  const { detail, setDetail, reconnect } = useSessionEvents(initial.session.id, initial);
  const view = useMemo(() => selectLatest(detail), [detail]);
  const { session } = detail;
  const busy = session.status === "queued" || session.status === "running";

  useEffect(() => {
    upsert(toHistoryItem(session));
  }, [session, upsert]);

  const rerun = useCallback(async () => {
    await api.sessions.rerun(session.id);
    setDetail({ ...detail, session: { ...session, status: "queued" } });
    reconnect();
  }, [session, detail, setDetail, reconnect]);

  const retry = useCallback(
    async (callId: string) => {
      try {
        await api.sessions.retry(session.id, callId);
        setDetail({ ...detail, session: { ...session, status: "running" } });
        reconnect();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [session, detail, setDetail, reconnect],
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
          disabledLabel="Running…"
          disabledPlaceholder="Running… you can ask a new question when this one finishes"
          onSubmit={ask}
        />
      </div>
    </div>
  );
}
