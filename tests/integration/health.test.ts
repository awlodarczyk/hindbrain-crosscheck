import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db/client";
import { env, resetEnvForTests } from "@/lib/env";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  const dir = mkdtempSync(join(tmpdir(), "hc-health-"));
  afterEach(() => {
    closeDb(getDb());
    vi.unstubAllEnvs();
    resetEnvForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the ok envelope with no-store", async () => {
    vi.stubEnv("DATA_DIR", dir);
    resetEnvForTests();
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      ok: true,
      data: { status: "ok", db: "ok", mode: env.APP_MODE, version: expect.any(String) },
    });
  });
});
