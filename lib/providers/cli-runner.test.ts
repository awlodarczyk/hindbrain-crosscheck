import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeSpawn } from "@/tests/helpers/fake-spawn";
import { runCli } from "./cli-runner";

const base = { timeoutMs: 1000, signal: new AbortController().signal };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("runCli", () => {
  it("collects output and writes stdin", async () => {
    const spawn = fakeSpawn({ stdout: "out", stderr: "err" });
    const r = await runCli("x", ["a"], { ...base, spawn, input: "hello" });
    expect(r).toMatchObject({ stdout: "out", stderr: "err", code: 0 });
    expect(spawn.children[0]?.stdinData).toBe("hello");
    expect(spawn.calls[0]?.opts.shell).toBe(false);
  });

  it("maps non-zero exit to cli_failed with a stderr tail", async () => {
    const spawn = fakeSpawn({ stderr: "e".repeat(2000), code: 2 });
    const err = await runCli("x", [], { ...base, spawn }).catch((e: Error) => e);
    expect(err).toMatchObject({ code: "cli_failed" });
    expect((err as Error).message.length).toBeLessThan(600);
    expect((err as Error).message).toContain("code 2");
  });

  it("maps ENOENT to cli_not_found", async () => {
    const spawn = fakeSpawn({ enoent: true });
    await expect(runCli("nope", [], { ...base, spawn })).rejects.toMatchObject({
      code: "cli_not_found",
      message: "nope was not found in PATH.",
    });
  });

  it("times out with SIGTERM then SIGKILL", async () => {
    vi.useFakeTimers();
    const spawn = fakeSpawn({ delayMs: 60_000 });
    const p = runCli("x", [], { ...base, spawn, timeoutMs: 100 }).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toMatchObject({ code: "timeout" });
    expect(spawn.children[0]?.kills).toEqual(["SIGTERM"]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(spawn.children[0]?.kills).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("aborts and kills", async () => {
    const ac = new AbortController();
    const spawn = fakeSpawn({ delayMs: 60_000, exitOnSigterm: true });
    const p = runCli("x", [], { ...base, spawn, signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: "aborted" });
    expect(spawn.children[0]?.kills).toEqual(["SIGTERM"]);
  });

  it("passes only allow-listed env plus opts.env", async () => {
    vi.stubEnv("SECRET_X", "s");
    const spawn = fakeSpawn({});
    await runCli("x", [], { ...base, spawn, env: { EXTRA: "1" } });
    const env = spawn.calls[0]?.opts.env as Record<string, string>;
    expect(env.SECRET_X).toBeUndefined();
    expect(env.PATH).toBeDefined();
    expect(env.EXTRA).toBe("1");
  });

  it("rejects when stdout exceeds the cap", async () => {
    const spawn = fakeSpawn({ stdout: "a".repeat(4 * 1024 * 1024 + 1), exitOnSigterm: true });
    await expect(runCli("x", [], { ...base, spawn })).rejects.toMatchObject({
      code: "cli_failed",
      message: "output too large",
    });
  });

  it("streams stderr lines", async () => {
    const lines: string[] = [];
    const spawn = fakeSpawn({ stderr: "one\ntwo\nthree" });
    await runCli("x", [], { ...base, spawn, onStderrLine: (l) => lines.push(l) });
    expect(lines).toEqual(["one", "two", "three"]);
  });
});
