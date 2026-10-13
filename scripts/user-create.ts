import { join } from "node:path";
import { hashPasswordSync } from "@/lib/auth/password";
import { openDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { env } from "@/lib/env";
import { createUser } from "@/lib/repos/users";
import { readNewPassword, requirePasswordStrength } from "./read-password";

/** Usage: [PASSWORD=...] pnpm user:create <email> */
const email = process.argv[2];
if (!email) throw new Error("usage: pnpm user:create <email>");
const password = await readNewPassword();
requirePasswordStrength(password);
const db = openDb(join(env.DATA_DIR, "crosscheck.db"));
migrate(db);
const user = createUser(db, { email, passwordHash: hashPasswordSync(password) });
console.log(`created ${user.email}`);
