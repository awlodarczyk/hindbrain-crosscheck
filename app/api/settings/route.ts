import { buildSettingsView } from "@/lib/api/settings-view";
import { getRequestDb } from "@/lib/http/deps";
import { defineRoute } from "@/lib/http/route";
import { appendEvent } from "@/lib/repos/events";
import { putSettings } from "@/lib/repos/settings";
import { SettingsSchema } from "@/lib/settings/schema";

export const runtime = "nodejs";

export const GET = defineRoute({ op: "read" }, ({ ctx }) =>
  buildSettingsView(getRequestDb(), ctx.userId),
);

export const PUT = defineRoute({ op: "settings_write", body: SettingsSchema }, ({ ctx, body }) => {
  const db = getRequestDb();
  const settings = putSettings(db, ctx.userId, body, () => ctx.now);
  appendEvent(db, {
    sessionId: null,
    userId: ctx.userId,
    type: "settings_updated",
    payload: { keys: Object.keys(body) },
  });
  return { settings, savedAt: ctx.now.toISOString() };
});
