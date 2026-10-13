"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { SettingsView } from "@/lib/api/settings-dto";
import type { ProviderId } from "@/lib/db/enums";
import type { Settings } from "@/lib/settings/schema";

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const SAVE_DELAY_MS = 600;

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Returns a new object with `patch` merged over `base`; untouched branches are shared. */
function merge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlain(base) || !isPlain(patch)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = isPlain(v) && isPlain(base[k]) ? merge(base[k], v) : v;
  }
  return out as T;
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Could not save settings.");

/** Local settings state with a debounced autosave and key management helpers. */
export function useSettings(initial: SettingsView) {
  const { setTheme } = useTheme();
  const [view, setView] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(initial.savedAt);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Settings>(initial.settings);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    setSaving(true);
    try {
      const res = await api.settings.put(latest.current);
      setSavedAt(res.savedAt);
      setError(null);
    } catch (e) {
      setError(messageOf(e));
      toast.error(messageOf(e));
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(
    (patch: DeepPartial<Settings>) => {
      latest.current = merge(latest.current, patch);
      const settings = latest.current;
      setView((v) => ({ ...v, settings }));
      if (patch.appearance?.theme) setTheme(patch.appearance.theme);
      if (patch.appearance?.reduceMotion !== undefined) {
        document.documentElement.classList.toggle("reduce-motion", patch.appearance.reduceMotion);
      }
      if (patch.appearance) {
        window.dispatchEvent(
          new CustomEvent("hc:appearance-changed", { detail: patch.appearance }),
        );
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush, setTheme],
  );

  useEffect(() => {
    const { theme, reduceMotion } = initial.settings.appearance;
    setTheme(theme);
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applies the server value once on mount
  }, []);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void api.settings.put(latest.current).catch(() => undefined);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    const next = await api.settings.get();
    setView((v) => ({ ...next, settings: v.settings }));
  }, []);

  const putKey = useCallback(
    async (provider: ProviderId, apiKey: string) => {
      await api.settings.putKey({ provider, apiKey });
      await refresh();
    },
    [refresh],
  );
  const removeKey = useCallback(
    async (provider: ProviderId) => {
      await api.settings.removeKey(provider);
      await refresh();
    },
    [refresh],
  );
  const reveal = useCallback(
    async (provider: ProviderId, password?: string) =>
      (await api.settings.reveal({ provider, password })).apiKey,
    [],
  );
  const testProvider = useCallback((p: ProviderId) => api.settings.testProvider(p), []);

  return { view, update, saving, savedAt, error, putKey, removeKey, reveal, testProvider, refresh };
}
