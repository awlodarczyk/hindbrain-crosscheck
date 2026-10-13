import "server-only";
import type { SidebarProps } from "@/components/shell/sidebar";
import type { Db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { isHosted } from "@/lib/mode";
import { hasSecret } from "@/lib/repos/secrets";

const DEFAULT_HOST = "127.0.0.1:4173";

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).host : DEFAULT_HOST;
  } catch {
    return DEFAULT_HOST;
  }
}

/** Cheap sidebar status: run mode, host and whether any provider key (env or stored) exists. */
export function buildStatusLine(db: Db, userId: string): SidebarProps["statusLine"] {
  const keys =
    Boolean(env.ANTHROPIC_API_KEY) ||
    Boolean(env.OPENAI_API_KEY) ||
    hasSecret(db, userId, "claude") ||
    hasSecret(db, userId, "chatgpt");
  return { mode: isHosted() ? "hosted" : "local", host: hostOf(env.APP_URL), keys };
}
