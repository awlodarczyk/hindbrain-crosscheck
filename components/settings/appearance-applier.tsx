"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

export type Appearance = { theme: "light" | "dark" | "system"; reduceMotion: boolean };
export const APPEARANCE_EVENT = "hc:appearance-changed";

/** Applies the saved theme and reduce-motion preference app-wide and follows live changes. */
export function AppearanceApplier({ initial }: { initial: Appearance }) {
  const { setTheme } = useTheme();
  const setThemeRef = useRef(setTheme);
  setThemeRef.current = setTheme;

  useEffect(() => {
    const apply = (a: Partial<Appearance>) => {
      if (a.theme) setThemeRef.current(a.theme);
      if (a.reduceMotion !== undefined) {
        document.documentElement.classList.toggle("reduce-motion", a.reduceMotion);
      }
    };
    apply(initial);
    const on = (e: Event) => apply((e as CustomEvent<Partial<Appearance>>).detail);
    window.addEventListener(APPEARANCE_EVENT, on);
    return () => window.removeEventListener(APPEARANCE_EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial applies once on mount
  }, []);

  return null;
}
