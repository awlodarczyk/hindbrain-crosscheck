import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { SpawnFn } from "@/lib/providers/types";

export type FakeSpec = {
  stdout?: string;
  stderr?: string;
  code?: number;
  delayMs?: number;
  enoent?: boolean;
  exitOnSigterm?: boolean;
};

export type FakeChild = EventEmitter & {
  stdin: Writable;
  stdout: PassThrough;
  stderr: PassThrough;
  pid: undefined;
  kills: string[];
  stdinData: string;
  kill: (signal?: string) => boolean;
};

export type SpawnCall = { cmd: string; args: readonly string[]; opts: Record<string, unknown> };
export type FakeSpawn = SpawnFn & { calls: SpawnCall[]; children: FakeChild[] };

/** Builds a spawn stand-in; `spec` may be a function of (cmd, args) for per-command behaviour. */
export function fakeSpawn(spec: FakeSpec | ((cmd: string, args: readonly string[]) => FakeSpec)) {
  const calls: SpawnCall[] = [];
  const children: FakeChild[] = [];
  const fn = (cmd: string, args: readonly string[], opts: Record<string, unknown>) => {
    const s = typeof spec === "function" ? spec(cmd, args) : spec;
    calls.push({ cmd, args, opts });
    const child = new EventEmitter() as FakeChild;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdinData = "";
    child.kills = [];
    const stdin = new Writable({
      write(chunk, _enc, cb) {
        child.stdinData += String(chunk);
        cb();
      },
    });
    child.stdin = stdin;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (code: number) => {
      clearTimeout(timer);
      child.emit("close", code, null);
    };
    child.kill = (signal = "SIGTERM") => {
      child.kills.push(signal);
      if (signal === "SIGKILL" || s.exitOnSigterm) finish(137);
      return true;
    };
    children.push(child);
    if (s.enoent) {
      queueMicrotask(() =>
        child.emit("error", Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" })),
      );
    } else {
      timer = setTimeout(() => {
        if (s.stdout) child.stdout.write(s.stdout);
        if (s.stderr) child.stderr.write(s.stderr);
        setTimeout(() => finish(s.code ?? 0), 0);
      }, s.delayMs ?? 0);
    }
    return child;
  };
  return Object.assign(fn, { calls, children }) as unknown as FakeSpawn;
}
