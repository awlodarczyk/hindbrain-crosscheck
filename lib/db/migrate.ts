import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "./client";

const MIGRATIONS_DIR = "drizzle";

/** Applies unapplied `drizzle/*.sql` files in name order, each in a transaction. Returns the names applied. */
export function migrate(db: Db): { applied: string[] } {
  const sqlite = db.$client;
  sqlite.exec("CREATE TABLE IF NOT EXISTS __migrations (name text PRIMARY KEY, applied_at text)");
  const done = new Set(
    db.all<{ name: string }>(sql`select name from __migrations`).map((r) => r.name),
  );
  const dir = join(process.cwd(), MIGRATIONS_DIR);
  const pending = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !done.has(f))
    .sort();
  const record = sqlite.prepare("INSERT INTO __migrations (name, applied_at) VALUES (?, ?)");
  for (const name of pending) {
    const body = readFileSync(join(dir, name), "utf8");
    sqlite.transaction(() => {
      sqlite.exec(body);
      record.run(name, new Date().toISOString());
    })();
  }
  return { applied: pending };
}
