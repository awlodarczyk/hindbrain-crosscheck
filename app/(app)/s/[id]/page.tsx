import { notFound, redirect } from "next/navigation";
import { SessionView } from "@/components/session/session-view";
import { loadBundle } from "@/lib/api/sessions-dto";
import { buildSettingsView } from "@/lib/api/settings-view";
import { getServerUserId } from "@/lib/auth/server-user";
import { getRequestDb } from "@/lib/http/deps";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getRequestDb();
  const userId = await getServerUserId(db);
  if (!userId) redirect("/login");
  const detail = loadBundle(db, userId, id);
  if (!detail) notFound();
  const view = await buildSettingsView(db, userId);
  return <SessionView initial={detail} settings={view.settings} models={view.models} />;
}
