import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/toaster";
import { buildStatusLine } from "@/lib/api/status-line";
import { toListItem } from "@/lib/api/sessions-dto";
import { getServerUserId } from "@/lib/auth/server-user";
import { getRequestDb } from "@/lib/http/deps";
import { listSessions } from "@/lib/repos/sessions";

export const dynamic = "force-dynamic";

const INITIAL_LIMIT = 50;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const db = getRequestDb();
  const userId = await getServerUserId(db);
  const initialItems = userId
    ? listSessions(db, userId, { limit: INITIAL_LIMIT }).map(toListItem)
    : [];
  const statusLine = buildStatusLine(db, userId ?? "");
  return (
    <>
      <AppShell initialItems={initialItems} statusLine={statusLine}>
        {children}
      </AppShell>
      <Toaster />
    </>
  );
}
