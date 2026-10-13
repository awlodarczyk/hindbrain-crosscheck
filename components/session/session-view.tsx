"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useMobileChrome, useMobileTitle } from "@/components/shell/mobile-chrome";
import { useMedia } from "@/components/shell/use-media";
import { Button } from "@/components/ui/button";
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
import { SessionActions, SessionMenu } from "./session-actions";
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
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** The session screen: header, tabs, actions and the docked composer. */
export function SessionView({ initial, settings, models }: SessionViewProps) {
  const router = useRouter();
  const { upsert } = useSessionListActions();
  const { detail, connection, setDetail, reconnect } = useSessionEvents(
    initial.session.id,
    initial,
  );
  const view = useMemo(() => selectLatest(detail), [detail]);
  const { session } = detail;
  const isMobile = useMedia("(max-width: 768px)");
  const { actionsEl } = useMobileChrome();
  useMobileTitle(session.title ?? session.question);
  const busy = session.status === "queued" || session.status === "running";

  useEffect(() => {
    upsert(toHistoryItem(session));
  }, [session, upsert]);

  const rerun = useCallback(async () => {
    await api.sessions.rerun(session.id);
    setDetail((d) => ({ ...d, session: { ...d.session, status: "queued" } }));
    reconnect();
  }, [session.id, setDetail, reconnect]);

  const retry = useCallback(
    async (callId: string) => {
      try {
        await api.sessions.retry(session.id, callId);
        setDetail((d) => ({ ...d, session: { ...d.session, status: "running" } }));
        reconnect();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [session.id, setDetail, reconnect],
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
      {isMobile &&
        actionsEl &&
        createPortal(<SessionMenu detail={detail} busy={busy} onRerun={rerun} />, actionsEl)}
      {connection === "error" && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border-b border-border-default bg-bg-subtle px-4 py-2 text-base text-text-secondary md:px-8 md:text-sm"
        >
          Live updates disconnected.
          <Button variant="secondary" size="sm" className="min-h-11 md:min-h-0" onClick={reconnect}>
            Reconnect
          </Button>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-6 md:px-8">
        <SessionHeader session={session} meta={metaLine(session, view)} />
        <SessionTabs detail={detail} view={view} onRetry={(id) => void retry(id)} />
      </div>
      <div className="sticky bottom-0 mt-6 bg-bg-page md:border-t md:border-border-default md:px-8 md:py-3">
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
