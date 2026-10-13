"use client";

import { useEffect, useRef } from "react";

type Handlers = {
  onNew?: () => void;
  onSearch?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
};

function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA";
}

/** Global shortcuts: Mod+K search, Mod+N new, j/k next/prev (ignored while typing). */
export function useShortcuts(handlers: Handlers): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      const key = e.key.toLowerCase();
      if (e.metaKey || e.ctrlKey) {
        const fn = key === "k" ? h.onSearch : key === "n" ? h.onNew : undefined;
        if (!fn) return;
        e.preventDefault();
        fn();
        return;
      }
      if (e.altKey || e.shiftKey || isTyping(e.target)) return;
      if (key === "j") h.onNext?.();
      else if (key === "k") h.onPrev?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
