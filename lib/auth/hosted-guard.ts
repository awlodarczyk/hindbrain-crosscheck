import "server-only";
import { getDb, type Db } from "@/lib/db/client";
import type { AuthGuard } from "./guard";
import { readCookie, SESSION_COOKIE } from "./cookies";
import { readAuthSession } from "./session";

/** Guard that resolves the user from the `hc_session` cookie; null when absent, unknown or expired. */
export function createHostedAuth(getDbFn: () => Db, now?: () => Date): AuthGuard {
  return async (req) => {
    const token = readCookie(req, SESSION_COOKIE);
    const session = readAuthSession(getDbFn(), token, now);
    return session ? { userId: session.userId, renewed: session.renewed, token } : null;
  };
}

export const hostedAuth: AuthGuard = createHostedAuth(getDb);
