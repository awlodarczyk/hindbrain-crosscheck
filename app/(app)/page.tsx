import { redirect } from "next/navigation";
import { NewQuestionView } from "@/components/empty/new-question-view";
import { buildSettingsView } from "@/lib/api/settings-view";
import { getServerUserId } from "@/lib/auth/server-user";
import { getRequestDb } from "@/lib/http/deps";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = getRequestDb();
  const userId = await getServerUserId(db);
  if (!userId) redirect("/login");
  return <NewQuestionView initialView={await buildSettingsView(db, userId)} />;
}
