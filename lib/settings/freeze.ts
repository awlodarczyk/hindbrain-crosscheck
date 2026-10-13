/** Recursively freezes `value` in place and returns it. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
