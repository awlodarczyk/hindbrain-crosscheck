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
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "flex h-8 items-center rounded-control px-3 text-[13px] transition-colors hover:text-text-primary",
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
