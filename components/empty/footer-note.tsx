import { Lock } from "lucide-react";

/** Privacy and cost note pinned to the bottom of the main area. */
export function FooterNote({ mode }: { mode: "local" | "hosted" }) {
  return (
    <p className="flex items-center justify-center gap-1.5 py-4 font-mono text-[11px] text-text-muted">
      <Lock aria-hidden="true" className="size-3" />
      {mode === "local"
        ? "Runs locally · keys stay on this machine · ~4 API calls per question"
        : "Runs on your server · ~4 API calls per question"}
    </p>
  );
}
