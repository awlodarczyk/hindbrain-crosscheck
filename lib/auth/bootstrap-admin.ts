import type { Db } from "@/lib/db/client";
import type { Env } from "@/lib/env";
import { appendEvent } from "@/lib/repos/events";
import { createUser, findUserByEmail } from "@/lib/repos/users";
import { hashPasswordSync } from "./password";

/** Creates the admin from env when both vars are set and the email is unknown; never updates an existing user. */
export function bootstrapAdmin(
  db: Db,
  e: Pick<Env, "ADMIN_EMAIL" | "ADMIN_PASSWORD">,
): "created" | "exists" | "skipped" {
  if (!e.ADMIN_EMAIL || !e.ADMIN_PASSWORD) return "skipped";
  if (findUserByEmail(db, e.ADMIN_EMAIL)) return "exists";
  const user = createUser(db, {
    email: e.ADMIN_EMAIL,
    passwordHash: hashPasswordSync(e.ADMIN_PASSWORD),
  });
  appendEvent(db, { sessionId: null, userId: user.id, type: "admin_bootstrapped" });
  return "created";
}
