import { verifyPassword } from "@/lib/auth/password";
import type { Db } from "@/lib/db/client";
import { errors } from "@/lib/http/errors";
import { isHosted } from "@/lib/mode";
import { getUser } from "@/lib/repos/users";

/**
 * Re-verifies the account password before a stored key is revealed; local mode always passes.
 * @throws HttpError 403 `invalid_password` when the password does not match.
 */
export async function verifyRevealPassword(
  db: Db,
  userId: string,
  password: string,
): Promise<true> {
  if (!isHosted()) return true;
  const user = getUser(db, userId);
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw errors.forbidden("invalid_password", "Password is incorrect.");
  }
  return true;
}
