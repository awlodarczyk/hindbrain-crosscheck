import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { env } from "@/lib/env";
import { migrate } from "./migrate";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const MEMORY = ":memory:";

/** Opens a SQLite database (creating its directory) with WAL, FK enforcement and a busy timeout. */
export function openDb(path: string): Db {
  if (path !== MEMORY) mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  if (path !== MEMORY) sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

export function closeDb(db: Db): void {
  db.$client.close();
}

/** Opens the database at `path` and applies pending migrations. */
export function createDbAt(path: string): Db {
  const db = openDb(path);
  migrate(db);
  return db;
}

const globalForDb = globalThis as typeof globalThis & { __hcDb?: Db };

/** Process-wide singleton at `$DATA_DIR/crosscheck.db`. */
export function getDb(): Db {
  globalForDb.__hcDb ??= createDbAt(join(env.DATA_DIR, "crosscheck.db"));
  return globalForDb.__hcDb;
}
