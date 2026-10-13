import type { SidebarProps } from "./sidebar";

/** Pinned mono line describing where the app runs and whether provider keys exist. */
export function StatusLine({ mode, host, keys }: SidebarProps["statusLine"]) {
  const text =
    mode === "local" ? `Local · ${host} · ${keys ? "keys" : "no keys"}` : `Hosted · ${host}`;
  return (
    <p className="flex items-center gap-2 px-4 py-3 font-mono text-[11px] text-text-muted">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-status-supported" />
      <span className="truncate">{text}</span>
    </p>
  );
}
