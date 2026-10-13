import Link from "next/link";
import { focusRing } from "@/components/ui/ring";
import { cn } from "@/lib/utils";

export type NavKey = "general" | "models" | "verification" | "appearance" | "data";

/** Add a settings route by appending an entry here and creating its page. */
export const NAV_ITEMS: readonly { key: NavKey; label: string; href: string }[] = [
  { key: "general", label: "General", href: "/settings" },
  { key: "models", label: "Models", href: "/settings/models" },
  { key: "verification", label: "Verification", href: "/settings/verification" },
  { key: "appearance", label: "Appearance", href: "/settings/appearance" },
  { key: "data", label: "Data", href: "/settings/data" },
];

export function Nav({ active }: { active: NavKey }) {
  return (
    <nav
      aria-label="Settings"
      className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-1 md:px-0"
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "flex h-11 shrink-0 snap-start items-center rounded-full border border-border-default px-4 text-base transition-colors hover:text-text-primary md:h-8 md:rounded-control md:border-0 md:px-3 md:text-[13px]",
            item.key === active ? "bg-bg-muted text-text-primary" : "text-text-secondary",
            focusRing,
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
