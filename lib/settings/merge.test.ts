import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { mergeSettings } from "./merge";

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

describe("mergeSettings", () => {
  it("overrides one field and keeps the rest", () => {
    const { settings, warnings } = mergeSettings(
      DEFAULT_SETTINGS,
      deepFreeze({ tuning: { temperature: 0.5 } }),
    );
    expect(settings.tuning.temperature).toBe(0.5);
    expect(settings.tuning.webSearchMax).toBe(DEFAULT_SETTINGS.tuning.webSearchMax);
    expect(warnings).toEqual([]);
  });
  it("replaces arrays", () => {
    const base = {
      ...DEFAULT_SETTINGS,
      tuning: { ...DEFAULT_SETTINGS.tuning, preferredDomains: ["a.com", "b.com"] },
    };
    const { settings } = mergeSettings(
      deepFreeze(base),
      deepFreeze({ tuning: { preferredDomains: ["c.org"] } }),
    );
    expect(settings.tuning.preferredDomains).toEqual(["c.org"]);
  });
  it.each(["x", null, { tuning: { temperature: 9 } }])("falls back with warning for %j", (bad) => {
    const { settings, warnings } = mergeSettings(DEFAULT_SETTINGS, bad);
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(warnings.length).toBeGreaterThan(0);
  });
  it("names the offending path", () => {
    const { warnings } = mergeSettings(DEFAULT_SETTINGS, { tuning: { temperature: 9 } });
    expect(warnings.join()).toContain("tuning.temperature");
  });
  it("returns a deep-frozen result", () => {
    const { settings } = mergeSettings(DEFAULT_SETTINGS, { tuning: { temperature: 0.5 } });
    expect(Object.isFrozen(settings)).toBe(true);
    expect(Object.isFrozen(settings.tuning)).toBe(true);
    expect(Object.isFrozen(settings.tuning.preferredDomains)).toBe(true);
  });
  it("ignores prototype-pollution keys", () => {
    const evil = JSON.parse(
      '{"__proto__":{"polluted":true},"tuning":{"__proto__":{"polluted":true}}}',
    );
    const { settings, warnings } = mergeSettings(DEFAULT_SETTINGS, evil);
    expect(warnings).toEqual([]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((settings as Record<string, unknown>).polluted).toBeUndefined();
    expect((settings.tuning as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("does not mutate inputs", () => {
    const input = { tuning: { temperature: 0.5, preferredDomains: ["a.com"] } };
    const before = structuredClone(input);
    const defaultsBefore = structuredClone(DEFAULT_SETTINGS);
    mergeSettings(DEFAULT_SETTINGS, input);
    expect(input).toEqual(before);
    expect(DEFAULT_SETTINGS).toEqual(defaultsBefore);
  });
});
