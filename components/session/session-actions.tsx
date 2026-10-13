"use client";

import { Copy, Download, MoreHorizontal, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { focusRing } from "@/components/ui/ring";
import { api } from "@/lib/api/client";
import type { SessionDetail } from "@/lib/api/sessions-dto";
import { buildMarkdownReport } from "@/lib/pipeline/report";
import { cn } from "@/lib/utils";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

type ActionProps = {
  detail: SessionDetail;
  busy: boolean;
  onRerun: () => Promise<void>;
};

function useSessionActions({ detail, onRerun }: ActionProps) {
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

  return { rerun, copy, exportUrl: api.sessions.exportUrl(detail.session.id, "json") };
}

/** Re-run, Copy report and Export JSON buttons for the topbar. */
export function SessionActions(props: ActionProps) {
  const { busy } = props;
  const { rerun, copy, exportUrl } = useSessionActions(props);
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
        <a href={exportUrl} download>
          <Download aria-hidden className="size-3.5" />
          Export JSON
        </a>
      </Button>
    </div>
  );
}

/** The same actions behind a single 44 px "more" button for the mobile top bar. */
export function SessionMenu(props: ActionProps) {
  const { busy } = props;
  const { rerun, copy, exportUrl } = useSessionActions(props);
  const item = "h-11 text-base";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        className={cn(
          "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-control text-text-primary hover:bg-bg-muted",
          focusRing,
        )}
      >
        <MoreHorizontal aria-hidden className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className={item} disabled={busy} onSelect={() => void rerun()}>
          <RefreshCw aria-hidden className="size-4" />
          Re-run
        </DropdownMenuItem>
        <DropdownMenuItem className={item} disabled={busy} onSelect={() => void copy()}>
          <Copy aria-hidden className="size-4" />
          Copy report
        </DropdownMenuItem>
        <DropdownMenuItem className={item} asChild>
          <a href={exportUrl} download>
            <Download aria-hidden className="size-4" />
            Export JSON
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
