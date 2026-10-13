import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { createBus } from "@/lib/jobs/bus";
import { createRunner, type Runner } from "@/lib/jobs/runner";
import { createMockProvider } from "@/lib/providers/mock";
import { createSession } from "@/lib/repos/sessions";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { GET } from "@/app/api/sessions/[id]/events/route";

type Frame = { id?: number; event: string; data: { type?: string; status?: string } };

let db: Db;
let runner: Runner;
let userId = LOCAL_USER_ID;
const allow = {
  consume: async () => ({ allowed: true, retryAfterSec: 0, remaining: 99, layer: null }),
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function parse(chunk: string): Frame {
  const id = /^id: (\d+)$/m.exec(chunk)?.[1];
  return {
    id: id ? Number(id) : undefined,
    event: /^event: (.+)$/m.exec(chunk)?.[1] ?? "",
    data: JSON.parse(/^data: (.+)$/m.exec(chunk)?.[1] ?? "null"),
  };
}

async function readAll(res: Response): Promise<Frame[]> {
  const r = res.body!.getReader();
  const dec = new TextDecoder();
  const frames: Frame[] = [];
  for (;;) {
    const { value, done } = await r.read();
    if (done) return frames;
    const text = dec.decode(value);
    if (!text.startsWith(":")) frames.push(parse(text));
  }
}

const open = (id: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://x/api/sessions/${id}/events`, { headers }), ctx(id));

const seed = () =>
  createSession(db, {
    userId: LOCAL_USER_ID,
    question: "Does stretching help?",
    mode: "ask",
    settingsSnapshot: DEFAULT_SETTINGS,
  }).id;
const run = (sessionId: string) =>
  runner.enqueue({ sessionId, userId: LOCAL_USER_ID, reason: "initial" });
function start(): string {
  const id = seed();
  run(id);
  return id;
}

beforeEach(() => {
  userId = LOCAL_USER_ID;
  db = createTestDb();
  ensureLocalUser(db);
  const bus = createBus();
  runner = createRunner({
    db,
    bus,
    providersFor: async () => ({
      claude: createMockProvider("claude", { delayMs: 20 }),
      chatgpt: createMockProvider("chatgpt", { delayMs: 20 }),
    }),
    settingsFor: () => DEFAULT_SETTINGS,
  });
  setDepsForTests({ db, runner, bus, limiter: allow, auth: async () => ({ userId }) });
});
afterEach(() => resetDepsForTests());

describe("GET /api/sessions/[id]/events", () => {
  it("streams snapshot, ordered run events and session.done", async () => {
    const id = seed();
    const res = await open(id);
    run(id);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    const frames = await readAll(res);
    expect(frames[0]?.event).toBe("snapshot");
    expect(frames[0]?.id).toBeUndefined();
    const ids = frames.slice(1).map((f) => f.id!);
    expect(ids.every((n, i) => i === 0 || n > ids[i - 1]!)).toBe(true);
    const events = frames.map((f) => f.event);
    expect(events).toContain("run.started");
    expect(events.filter((e) => e === "call.done")).toHaveLength(4);
    expect(events.at(-1)).toBe("session.done");
  });

  it("replays events after Last-Event-ID then closes", async () => {
    const id = start();
    const first = await readAll(await open(id));
    const lastId = first.at(-1)!.id!;
    const frames = await readAll(await open(id, { "last-event-id": String(lastId - 2) }));
    expect(frames.map((f) => f.id)).toEqual([undefined, lastId - 1, lastId]);
    expect(frames.at(-1)?.event).toBe("session.done");
  });

  it("sends a synthetic session.done for a finished session", async () => {
    const id = start();
    await runner.drain();
    const frames = await readAll(await open(id));
    expect(frames.map((f) => f.event)).toEqual(["snapshot", "session.done"]);
    expect(frames[1]?.data.status).toBe("done");
  });

  it("returns 404 for another user's session", async () => {
    const id = start();
    userId = "someone-else";
    expect((await open(id)).status).toBe(404);
  });
});
