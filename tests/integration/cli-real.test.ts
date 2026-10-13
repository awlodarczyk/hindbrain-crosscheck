import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { detectCli } from "@/lib/providers/cli-detect";

const claudeInstalled = spawnSync("which", ["claude"]).status === 0;

describe.skipIf(!claudeInstalled)("real claude cli", () => {
  it("detects the installed CLI", async () => {
    const info = await detectCli("claude");
    expect(info.found).toBe(true);
    expect(info.version).toBeTruthy();
  });
});

const codexInstalled = spawnSync("which", ["codex"]).status === 0;

describe.skipIf(!codexInstalled)("real codex cli", () => {
  it("detects the installed CLI", async () => {
    const info = await detectCli("codex");
    expect(info.found).toBe(true);
    expect(info.version).toBeTruthy();
  });
});
