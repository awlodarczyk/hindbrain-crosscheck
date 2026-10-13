import { SettingsSchema, type Settings } from "./schema";

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function deepMerge(base: Plain, over: Plain): Plain {
  const out: Plain = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = isPlain(b) && isPlain(v) ? deepMerge(b, v) : v;
  }
  return out;
}

/**
 * Deep-merges `dbJson` over `defaults` (arrays replaced) and validates the result.
 * Invalid or non-object input yields `defaults` plus warnings naming the failing paths.
 * Inputs are never mutated.
 */
export function mergeSettings(
  defaults: Settings,
  dbJson: unknown,
): { settings: Settings; warnings: readonly string[] } {
  if (!isPlain(dbJson)) {
    return { settings: defaults, warnings: ["settings: stored value is not an object"] };
  }
  const parsed = SettingsSchema.safeParse(deepMerge(defaults as unknown as Plain, dbJson));
  if (parsed.success) return { settings: parsed.data, warnings: [] };
  const warnings = parsed.error.issues.map(
    (i) => `${i.path.join(".") || "settings"}: ${i.message}`,
  );
  return { settings: defaults, warnings };
}
