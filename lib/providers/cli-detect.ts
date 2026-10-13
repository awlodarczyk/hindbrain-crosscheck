import { runCli } from "./cli-runner";
import type { SpawnFn } from "./types";

export type CliName = "claude" | "codex";
export type CliInfo = {
  found: boolean;
  path?: string;
  version?: string;
  account?: string;
  checkedAt: string;
  detail?: string;
};
export type DetectOptions = {
  spawn?: SpawnFn;
  ttlMs?: number;
  now?: () => number;
  env?: Record<string, string>;
};

const PROBE_TIMEOUT_MS = 3000;
const DEFAULT_TTL_MS = 60_000;
const cache = new Map<CliName, { at: number; info: CliInfo }>();

export function clearCliCache(): void {
  cache.clear();
}

const firstLine = (s: string) => s.split("\n")[0]?.trim() ?? "";

async function probe(name: CliName, opts: DetectOptions, now: number): Promise<CliInfo> {
  const checkedAt = new Date(now).toISOString();
  const run = (cmd: string, args: string[]) =>
    runCli(cmd, args, {
      timeoutMs: PROBE_TIMEOUT_MS,
      signal: new AbortController().signal,
      spawn: opts.spawn,
      env: opts.env,
    });
  try {
    const path = firstLine(
      (await run(process.platform === "win32" ? "where" : "which", [name])).stdout,
    );
    if (!path) return { found: false, checkedAt, detail: `${name} was not found in PATH.` };
    const version = firstLine((await run(path, ["--version"])).stdout);
    return { found: true, path, version, checkedAt };
  } catch (e) {
    return { found: false, checkedAt, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Locates a CLI and reads its version; never throws. Results are cached per name for `ttlMs`. */
export async function detectCli(name: CliName, opts: DetectOptions = {}): Promise<CliInfo> {
  const now = (opts.now ?? Date.now)();
  const hit = cache.get(name);
  if (hit && now - hit.at < (opts.ttlMs ?? DEFAULT_TTL_MS)) return hit.info;
  const info = await probe(name, opts, now);
  cache.set(name, { at: now, info });
  return info;
}
