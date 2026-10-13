"use client";

import { Copy } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import type { SettingsView } from "@/lib/api/settings-dto";
import { Nav, NAV_ITEMS, type NavKey } from "./nav";
import { SavedIndicator } from "./saved-indicator";
import { SettingsProvider, useSettingsView } from "./settings-context";

const SUB = {
  local: "Keys stay on this machine. Nothing is sent anywhere except the two APIs.",
  hosted: "Keys are stored encrypted on the server. Nothing is sent anywhere except the two APIs.",
};

export async function copyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    toast.success("Path copied");
  } catch {
    toast.error("Could not copy the path");
  }
}

function activeOf(pathname: string | null): NavKey {
  const seg = /^\/settings\/([^/]+)/.exec(pathname ?? "")?.[1];
  return NAV_ITEMS.find((i) => i.key === seg)?.key ?? "general";
}

function Frame({ children }: { children: ReactNode }) {
  const { view, dataDir, saving, savedAt } = useSettingsView();
  const active = activeOf(usePathname());
  const label = NAV_ITEMS.find((i) => i.key === active)?.label ?? "General";
  return (
    <div className="flex flex-col">
      <Topbar
        crumbs={[{ label: "Settings", href: "/settings" }, { label }]}
        actions={
          view.mode === "local" && dataDir ? (
            <Button variant="secondary" onClick={() => void copyPath(dataDir)}>
              <Copy className="size-4" />
              Copy data path
            </Button>
          ) : null
        }
      />
      <div className="px-4 pb-10 pt-6 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-text-primary">Settings</h1>
            <p className="mt-1 text-base md:text-[14px] text-text-secondary">{SUB[view.mode]}</p>
          </div>
          <SavedIndicator savedAt={savedAt} saving={saving} />
        </div>
        {view.mode === "local" && dataDir && (
          <Button
            variant="secondary"
            className="mt-4 min-h-11 md:hidden"
            onClick={() => void copyPath(dataDir)}
          >
            <Copy className="size-4" />
            Copy data path
          </Button>
        )}
        <div className="mt-6 grid gap-6 md:grid-cols-[170px_minmax(0,740px)]">
          <Nav active={active} />
          <div className="flex flex-col gap-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Settings frame: topbar, heading, left nav and the routed content. */
export function SettingsShell({
  view,
  dataDir = null,
  children,
}: {
  view: SettingsView;
  dataDir?: string | null;
  children: ReactNode;
}) {
  return (
    <SettingsProvider view={view} dataDir={dataDir}>
      <Frame>{children}</Frame>
    </SettingsProvider>
  );
}
