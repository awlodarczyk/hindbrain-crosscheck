import { resolve } from "node:path";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsShell } from "@/components/settings/shell";
import { buildSettingsView } from "@/lib/api/settings-view";
import { getServerUserId } from "@/lib/auth/server-user";
import { env } from "@/lib/env";
import { getRequestDb } from "@/lib/http/deps";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const db = getRequestDb();
  const userId = await getServerUserId(db);
  if (!userId) redirect("/login");
  const view = await buildSettingsView(db, userId);
  const dataDir = view.mode === "local" ? resolve(env.DATA_DIR) : null;
  return (
    <SettingsShell view={view} dataDir={dataDir}>
      {children}
    </SettingsShell>
  );
}
