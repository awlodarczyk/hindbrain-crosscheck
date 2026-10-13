import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { focusRing } from "@/components/ui/ring";
import { cn } from "@/lib/utils";

/** 52 px top bar for narrow viewports: menu button, centred title, actions slot. */
export function MobileTopbar({
  title,
  onMenu,
  actions,
}: {
  title: string;
  onMenu: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="box-content flex h-[52px] shrink-0 items-center border-b border-border-default px-2 pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className={cn(
          "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-control text-text-primary hover:bg-bg-muted",
          focusRing,
        )}
      >
        <Menu className="size-5" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-text-primary">
        {title}
      </h1>
      <div className="flex min-w-11 items-center justify-end [&>*]:min-h-11 [&>*]:min-w-11">
        {actions}
      </div>
    </header>
  );
}
