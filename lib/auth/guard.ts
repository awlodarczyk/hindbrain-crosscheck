import "server-only";
import { getDb, type Db } from "@/lib/db/client";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";

export type AuthResult = { userId: string; renewed?: boolean; token?: string };
export type AuthGuard = (req: Request) => Promise<AuthResult | null>;

/** Guard that always resolves the local user, creating its row on first use. */
export function createLocalAuth(db: Db | (() => Db)): AuthGuard {
  let ready = false;
  return async () => {
    if (!ready) {
      ensureLocalUser(typeof db === "function" ? db() : db);
      ready = true;
    }
    return { userId: LOCAL_USER_ID };
  };
}

export const localAuth: AuthGuard = createLocalAuth(getDb);
