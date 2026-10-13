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
  /** Explicit binary path; skips `which` and probes this path. */
  path?: string;
};

const PROBE_TIMEOUT_MS = 3000;
const DEFAULT_TTL_MS = 60_000;
const MISS_TTL_MS = 10_000;
const cache = new Map<string, { at: number; info: CliInfo }>();
const inflight = new Map<string, Promise<CliInfo>>();

export function clearCliCache(): void {
  cache.clear();
  inflight.clear();
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
    const path =
      opts.path ??
      firstLine((await run(process.platform === "win32" ? "where" : "which", [name])).stdout);
    if (!path) return { found: false, checkedAt, detail: `${name} was not found in PATH.` };
    const version = firstLine((await run(path, ["--version"])).stdout);
    return { found: true, path, version, checkedAt };
  } catch (e) {
    return { found: false, checkedAt, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Locates a CLI and reads its version; never throws. Hits are cached for `ttlMs`, misses for 10 s. */
export async function detectCli(name: CliName, opts: DetectOptions = {}): Promise<CliInfo> {
  const now = (opts.now ?? Date.now)();
  const key = `${name}:${opts.path ?? ""}`;
  const hit = cache.get(key);
  if (hit) {
    const ttl = hit.info.found ? (opts.ttlMs ?? DEFAULT_TTL_MS) : MISS_TTL_MS;
    if (now - hit.at < ttl) return hit.info;
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = probe(name, opts, now)
    .then((info) => {
      cache.set(key, { at: now, info });
      return info;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
