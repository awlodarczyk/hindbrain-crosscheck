import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema-auth";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { deepFreeze } from "@/lib/settings/freeze";
import { mergeSettings } from "@/lib/settings/merge";
import { SettingsSchema, type Settings } from "@/lib/settings/schema";

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function getSettingsWithWarnings(
  db: Db,
  userId: string,
): { settings: Settings; warnings: readonly string[]; updatedAt: string | null } {
  const row = db.select().from(settings).where(eq(settings.userId, userId)).get();
  if (!row) return { settings: DEFAULT_SETTINGS, warnings: [], updatedAt: null };
  const merged = mergeSettings(DEFAULT_SETTINGS, parseJson(row.json));
  return { settings: merged.settings, warnings: merged.warnings, updatedAt: row.updatedAt };
}

export function getSettings(db: Db, userId: string): Settings {
  return getSettingsWithWarnings(db, userId).settings;
}

/** Validates and upserts the user's settings; returns the stored value, frozen. @throws ZodError when invalid. */
export function putSettings(
  db: Db,
  userId: string,
  s: Settings,
  now: () => Date = () => new Date(),
): Settings {
  const valid = SettingsSchema.parse(s);
  const values = { json: JSON.stringify(valid), updatedAt: now().toISOString() };
  db.insert(settings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: settings.userId, set: values })
    .run();
  return deepFreeze(valid);
}
