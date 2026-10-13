import { spawn as nodeSpawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { ProviderError } from "./errors";
import type { SpawnFn } from "./types";

export type CliResult = { stdout: string; stderr: string; code: number; durationMs: number };
export type RunCliOptions = {
  input?: string;
  timeoutMs: number;
  signal: AbortSignal;
  env?: Record<string, string>;
  cwd?: string;
  spawn?: SpawnFn;
  onStderrLine?: (line: string) => void;
  stderrTailChars?: number;
};

/** Parent env keys copied to children; everything else (API keys included) is withheld. */
export const CHILD_ENV_ALLOWLIST: readonly string[] = [
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "XDG_CONFIG_HOME",
];

const STDERR_CAP = 64 * 1024;
const STDOUT_CAP = 4 * 1024 * 1024;
const KILL_GRACE_MS = 5000;
const IS_POSIX = process.platform !== "win32";

function childEnv(extra: Record<string, string> | undefined): Record<string, string> {
  // The only process.env read outside lib/env.ts: copies allow-listed keys.
  const base = CHILD_ENV_ALLOWLIST.flatMap((k) => {
    const v = process.env[k];
    return v === undefined ? [] : [[k, v] as const];
  });
  return { ...Object.fromEntries(base), ...extra };
}

function signalTree(child: ChildProcess, sig: NodeJS.Signals) {
  try {
    if (IS_POSIX && child.pid) process.kill(-child.pid, sig);
    else child.kill(sig);
  } catch {
    child.kill(sig);
  }
}

/** Runs `cmd` without a shell and resolves with its output; rejects with ProviderError on failure. */
export function runCli(
  cmd: string,
  args: readonly string[],
  opts: RunCliOptions,
): Promise<CliResult> {
  const tailChars = opts.stderrTailChars ?? 500;
  return new Promise((resolve, reject) => {
    if (opts.signal.aborted) return reject(new ProviderError("aborted", "Request aborted."));
    const started = Date.now();
    const child: ChildProcess = (opts.spawn ?? nodeSpawn)(cmd, [...args], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv(opts.env) as NodeJS.ProcessEnv,
      cwd: opts.cwd,
      detached: IS_POSIX,
    });
    let stdout = "";
    let stderr = "";
    let pending = "";
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      clearTimeout(timer);
      opts.signal.removeEventListener("abort", onAbort);
    };
    const fail = (err: ProviderError, kill: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (kill) {
        signalTree(child, "SIGTERM");
        graceTimer = setTimeout(() => signalTree(child, "SIGKILL"), KILL_GRACE_MS);
        child.once("close", () => clearTimeout(graceTimer));
      }
      reject(err);
    };
    const onAbort = () => fail(new ProviderError("aborted", "Request aborted."), true);
    const timer = setTimeout(
      () =>
        fail(new ProviderError("timeout", `${cmd} timed out after ${opts.timeoutMs} ms.`), true),
      opts.timeoutMs,
    );
    opts.signal.addEventListener("abort", onAbort, { once: true });

    child.stdout?.on("data", (d: Buffer | string) => {
      stdout += String(d);
      if (stdout.length > STDOUT_CAP)
        fail(new ProviderError("cli_failed", "output too large"), true);
    });
    child.stderr?.on("data", (d: Buffer | string) => {
      stderr = (stderr + String(d)).slice(-STDERR_CAP);
      const lines = (pending + String(d)).split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) opts.onStderrLine?.(line);
    });
    child.on("error", (e: NodeJS.ErrnoException) =>
      fail(
        e.code === "ENOENT"
          ? new ProviderError("cli_not_found", `${cmd} was not found in PATH.`, { cause: e })
          : new ProviderError("cli_failed", `${cmd} failed to start: ${e.message}`, { cause: e }),
        false,
      ),
    );
    child.on("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (pending) opts.onStderrLine?.(pending);
      if (code === 0) return resolve({ stdout, stderr, code, durationMs: Date.now() - started });
      reject(
        new ProviderError(
          "cli_failed",
          `${cmd} exited with code ${code}: ${stderr.slice(-tailChars)}`,
        ),
      );
    });
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(opts.input ?? "");
  });
}
