"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SettingsView } from "@/lib/api/settings-dto";
import { useSettings } from "./use-settings";

type Value = ReturnType<typeof useSettings> & { dataDir: string | null };
const Ctx = createContext<Value | null>(null);

/** Owns the settings state shared by every settings route. */
export function SettingsProvider({
  view,
  dataDir,
  children,
}: {
  view: SettingsView;
  dataDir: string | null;
  children: ReactNode;
}) {
  const settings = useSettings(view);
  return <Ctx.Provider value={{ ...settings, dataDir }}>{children}</Ctx.Provider>;
}

export function useSettingsView(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSettingsView must be used inside SettingsProvider");
  return v;
}
