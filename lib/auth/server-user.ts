import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readAuthSession } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { isHosted } from "@/lib/mode";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";

/** User id for the current server-component render, or null when signed out (hosted only). */
export async function getServerUserId(db: Db): Promise<string | null> {
  if (!isHosted()) {
    ensureLocalUser(db);
    return LOCAL_USER_ID;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readAuthSession(db, token)?.userId ?? null;
}
