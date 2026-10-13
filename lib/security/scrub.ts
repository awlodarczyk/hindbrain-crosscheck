const KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}/g;
const BEARER_PATTERN = /\bBearer [A-Za-z0-9._-]+/g;
const MAX_DEPTH = 8;
const MASK = "[redacted]";

/** Masks API-key-shaped (`sk-…`) and `Bearer …` tokens in free text. */
export function scrubSecrets(text: string): string {
  return text.replace(BEARER_PATTERN, MASK).replace(KEY_PATTERN, MASK);
}

/**
 * Returns a copy of `value` with every string scrubbed; Errors become plain objects carrying name,
 * message, stack and own enumerable properties. Nesting deeper than 8 levels is returned unchanged.
 */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubSecrets(value);
  if (value === null || typeof value !== "object" || depth >= MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const entries = Object.entries(value).map(([k, v]) => [k, scrubValue(v, depth + 1)] as const);
  if (!(value instanceof Error)) return Object.fromEntries(entries);
  return {
    ...Object.fromEntries(entries),
    type: value.name,
    message: scrubSecrets(value.message),
    stack: value.stack === undefined ? undefined : scrubSecrets(value.stack),
  };
}
