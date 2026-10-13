"use client";

import { Copy, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { SessionDetail } from "@/lib/api/sessions-dto";
import { buildMarkdownReport } from "@/lib/pipeline/report";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** Re-run, Copy report and Export JSON buttons for the topbar. */
export function SessionActions({
  detail,
  busy,
  onRerun,
}: {
  detail: SessionDetail;
  busy: boolean;
  onRerun: () => Promise<void>;
}) {
  const id = detail.session.id;

  async function rerun() {
    try {
      await onRerun();
      toast.success("Re-run queued");
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildMarkdownReport(detail, { now: new Date() }));
      toast.success("Report copied");
    } catch {
      toast.error("Could not copy the report");
    }
  }

  return (
    <div className={`flex items-center gap-2 ${busy ? "opacity-50" : ""}`}>
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void rerun()}>
        <RefreshCw aria-hidden className="size-3.5" />
        Re-run
      </Button>
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void copy()}>
        <Copy aria-hidden className="size-3.5" />
        Copy report
      </Button>
      <Button variant="secondary" size="sm" asChild>
        <a href={api.sessions.exportUrl(id, "json")} download>
          <Download aria-hidden className="size-3.5" />
          Export JSON
        </a>
      </Button>
    </div>
  );
}
