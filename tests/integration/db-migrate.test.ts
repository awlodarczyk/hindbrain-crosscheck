import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvForTests } from "@/lib/env";
import { sql } from "drizzle-orm";
import { createTestDb } from "@/lib/db/test-db";
import { migrate } from "@/lib/db/migrate";
import { closeDb, createDbAt, getDb, openDb } from "@/lib/db/client";

const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "hc-db-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("migrations", () => {
  it("creates every table", () => {
    const db = createTestDb();
    const rows = db.all<{ name: string }>(
      sql`select name from sqlite_master where type in ('table','view') order by name`,
    );
    const names = rows.map((r) => r.name);
    for (const t of [
      "users",
      "auth_sessions",
      "settings",
      "provider_secrets",
      "sessions",
      "runs",
      "calls",
      "claims",
      "events",
      "sessions_fts",
      "__migrations",
    ])
      expect(names).toContain(t);
  });

  it("is idempotent", () => {
    const db = createTestDb();
    expect(migrate(db).applied).toEqual([]);
  });

  it("enforces foreign keys", () => {
    const db = createTestDb();
    let cause: unknown;
    try {
      db.run(
        sql`insert into runs (id, session_id, attempt, reason, status, started_at) values ('r1','nope',1,'initial','queued','2026-01-01T00:00:00Z')`,
      );
    } catch (e) {
      cause = (e as Error).cause;
    }
    expect(String(cause)).toMatch(/FOREIGN KEY/);
  });

  it("uses WAL on a file database", () => {
    const db = openDb(join(tmp(), "nested", "x.db"));
    const rows = db.all<{ journal_mode: string }>(sql`pragma journal_mode`);
    expect(rows[0]?.journal_mode).toBe("wal");
    closeDb(db);
  });

  it("createDbAt migrates a fresh file database", () => {
    const db = createDbAt(join(tmp(), "c.db"));
    const rows = db.all<{ name: string }>(sql`select name from sqlite_master where name = 'users'`);
    expect(rows).toHaveLength(1);
    closeDb(db);
  });

  it("getDb returns a memoized database under DATA_DIR", () => {
    vi.stubEnv("DATA_DIR", tmp());
    resetEnvForTests();
    const db = getDb();
    expect(getDb()).toBe(db);
    closeDb(db);
    delete (globalThis as { __hcDb?: unknown }).__hcDb;
  });
  it("closeDb on the singleton lets getDb open a fresh handle", () => {
    const dir = mkdtempSync(join(tmpdir(), "hc-singleton-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("APP_SECRET", "x".repeat(32));
    resetEnvForTests();
    const first = getDb();
    closeDb(first);
    const second = getDb();
    expect(second).not.toBe(first);
    expect(second.$client.open).toBe(true);
    closeDb(second);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });
});
