import { beforeEach, describe, expect, it } from "vitest";
import { fakeSpawn } from "@/tests/helpers/fake-spawn";
import { clearCliCache, detectCli } from "./cli-detect";

const ok = (cmd: string) =>
  cmd === "which" ? { stdout: "/bin/claude\n" } : { stdout: "2.1.0 (Claude Code)\nextra\n" };

beforeEach(() => clearCliCache());

describe("detectCli", () => {
  it("reports found with path and version", async () => {
    const info = await detectCli("claude", { spawn: fakeSpawn(ok) });
    expect(info).toMatchObject({
      found: true,
      path: "/bin/claude",
      version: "2.1.0 (Claude Code)",
    });
  });

  it("reports not found without throwing", async () => {
    const info = await detectCli("codex", { spawn: fakeSpawn({ code: 1 }) });
    expect(info.found).toBe(false);
    expect(info.detail).toBeTruthy();
  });

  it("caches within ttl and re-probes after", async () => {
    const spawn = fakeSpawn(ok);
    let t = 0;
    const opts = { spawn, ttlMs: 1000, now: () => t };
    await detectCli("claude", opts);
    await detectCli("claude", opts);
    expect(spawn.calls).toHaveLength(2);
    t = 1500;
    await detectCli("claude", opts);
    expect(spawn.calls).toHaveLength(4);
  });

  it("clearCliCache forces a re-probe", async () => {
    const spawn = fakeSpawn(ok);
    await detectCli("claude", { spawn });
    clearCliCache();
    await detectCli("claude", { spawn });
    expect(spawn.calls).toHaveLength(4);
  });
});
