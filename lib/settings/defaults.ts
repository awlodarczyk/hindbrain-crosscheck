import { SettingsSchema, type Settings } from "./schema";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Deep-frozen settings with every default applied. */
export const DEFAULT_SETTINGS: Settings = deepFreeze(SettingsSchema.parse({}));
