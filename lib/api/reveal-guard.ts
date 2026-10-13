import type { Db } from "@/lib/db/client";
import { errors } from "@/lib/http/errors";
import { isHosted } from "@/lib/mode";

/** Hook for password re-verification before a key is revealed; local mode always passes. */
export async function verifyRevealPassword(
  db: Db,
  userId: string,
  password: string,
): Promise<true> {
  void [db, userId, password];
  if (isHosted()) throw errors.unavailable("auth_unavailable", "Hosted auth is not available yet.");
  return true;
}
