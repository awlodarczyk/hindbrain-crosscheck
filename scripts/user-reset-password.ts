import { join } from "node:path";
import { hashPasswordSync } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { openDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { findUserByEmail, updatePasswordHash } from "@/lib/repos/users";
import { readNewPassword, requirePasswordStrength } from "./read-password";

/** Usage: [PASSWORD=...] pnpm user:reset-password <email>; signs the user out everywhere. */
const email = process.argv[2];
if (!email) throw new Error("usage: pnpm user:reset-password <email>");
const db = openDb(join(env.DATA_DIR, "crosscheck.db"));
const user = findUserByEmail(db, email);
if (!user) throw new Error(`no user with email ${email}`);
const password = await readNewPassword();
requirePasswordStrength(password);
updatePasswordHash(db, user.id, hashPasswordSync(password));
console.log(`password updated; ${revokeAllSessions(db, user.id)} session(s) revoked`);
