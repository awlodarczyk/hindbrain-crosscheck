import { deepFreeze } from "./freeze";
import { SettingsSchema, type Settings } from "./schema";

/** Deep-frozen settings with every default applied. */
export const DEFAULT_SETTINGS: Settings = deepFreeze(SettingsSchema.parse({}));
