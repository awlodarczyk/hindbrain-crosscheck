import { join } from "node:path";
import { openDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { env } from "@/lib/env";

const { applied } = migrate(openDb(join(env.DATA_DIR, "crosscheck.db")));
console.log(applied.length > 0 ? `applied: ${applied.join(", ")}` : "up to date");
