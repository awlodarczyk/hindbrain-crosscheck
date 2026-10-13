import { openDb, type Db } from "./client";
import { migrate } from "./migrate";

/** Fresh in-memory migrated database for tests. */
export function createTestDb(): Db {
  const db = openDb(":memory:");
  migrate(db);
  return db;
}
