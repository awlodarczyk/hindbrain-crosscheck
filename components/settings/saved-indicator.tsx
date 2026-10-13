"use client";

import { useEffect, useState } from "react";

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "Saved · HH:MM" status; the time renders after mount to avoid a timezone hydration mismatch. */
export function SavedIndicator({ savedAt, saving }: { savedAt: string | null; saving: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const text = saving ? "Saving…" : mounted && savedAt ? `Saved · ${clock(savedAt)}` : "";
  return (
    <span role="status" aria-live="polite" className="font-mono text-[12px] text-text-muted">
      {text}
    </span>
  );
}
