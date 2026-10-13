import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { createBus } from "@/lib/jobs/bus";
import { createRunner, type Runner } from "@/lib/jobs/runner";
import { ProviderError } from "@/lib/providers/errors";
import { createMockProvider, type MockOptions } from "@/lib/providers/mock";
import { listCallsForSession } from "@/lib/repos/calls";
import { listRuns } from "@/lib/repos/runs";
import { searchSessions } from "@/lib/repos/search";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { GET as deletedList } from "@/app/api/sessions/deleted/route";
import { GET as list, POST as create } from "@/app/api/sessions/route";
import { DELETE as deleteOne } from "@/app/api/sessions/[id]/route";
import { POST as rerun } from "@/app/api/sessions/[id]/rerun/route";
import { POST as restore } from "@/app/api/sessions/[id]/restore/route";
import { POST as retry } from "@/app/api/sessions/[id]/calls/[callId]/retry/route";

let db: Db;
let runner: Runner;
let userId = LOCAL_USER_ID;
let chatgptOpts: MockOptions = {};
let claudeOpts: MockOptions = {};
const allow = {
  consume: async () => ({ allowed: true, retryAfterSec: 0, remaining: 99, layer: null }),
};

const req = (method: string, body?: unknown) =>
  new Request("http://x/api", {
    method,
    headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const callCtx = (id: string, callId: string) => ({ params: Promise.resolve({ id, callId }) });
const createId = async (body: unknown): Promise<string> =>
  ((await (await create(req("POST", body))).json()) as { data: { id: string } }).data.id;
const code = async (res: Response) =>
  ((await res.json()) as { error: { code: string } }).error.code;

beforeEach(() => {
  userId = LOCAL_USER_ID;
  chatgptOpts = {};
  claudeOpts = {};
  db = createTestDb();
  ensureLocalUser(db);
  const bus = createBus();
  runner = createRunner({
    db,
    bus,
    providersFor: async () => ({
      claude: createMockProvider("claude", claudeOpts),
      chatgpt: createMockProvider("chatgpt", chatgptOpts),
    }),
    settingsFor: () => DEFAULT_SETTINGS,
  });
  setDepsForTests({ db, runner, bus, limiter: allow, auth: async () => ({ userId }) });
});
afterEach(() => resetDepsForTests());

describe("rerun", () => {
  it("queues a manual second run", async () => {
    const id = await createId({ question: "q" });
    await runner.drain();
    const res = await rerun(req("POST"), idCtx(id));
    expect(res.status).toBe(200);
    await runner.drain();
    const runs = listRuns(db, id);
    expect(runs).toHaveLength(2);
    expect(runs[1]).toMatchObject({ attempt: 2, reason: "manual" });
  });

  it("rejects while running", async () => {
    claudeOpts = { delayMs: 200 };
    chatgptOpts = { delayMs: 200 };
    const id = await createId({ question: "q" });
    const res = await rerun(req("POST"), idCtx(id));
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("already_running");
    await runner.drain();
  });
});

describe("retry", () => {
  it("rejects a done call", async () => {
    const id = await createId({ question: "q" });
    await runner.drain();
    const call = listCallsForSession(db, id)[0]!;
    const res = await retry(req("POST"), callCtx(id, call.id));
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("not_failed");
  });

  it("re-runs only the failed answer and the review of it", async () => {
    chatgptOpts = { failWith: new ProviderError("timeout", "slow") };
    const id = await createId({ question: "q" });
    await runner.drain();
    const failed = listCallsForSession(db, id).find(
      (c) => c.provider === "chatgpt" && c.kind === "answer",
    )!;
    expect(failed.status).toBe("failed");
    chatgptOpts = {};
    const res = await retry(req("POST"), callCtx(id, failed.id));
    expect(res.status).toBe(200);
    await runner.drain();
    const calls = listCallsForSession(db, id);
    expect(calls).toHaveLength(4);
    const answer = calls.find((c) => c.provider === "chatgpt" && c.kind === "answer")!;
    expect(answer.status).toBe("done");
    expect(calls.find((c) => c.provider === "claude" && c.kind === "review")?.status).toBe("done");
    expect(calls.find((c) => c.provider === "claude" && c.kind === "answer")?.status).toBe("done");
  });

  it("rejects a pasted answer", async () => {
    const id = await createId({ question: "q", mode: "paste", pasted: { claude: "Some answer." } });
    await runner.drain();
    const pasted = listCallsForSession(db, id).find((c) => c.pasted)!;
    const res = await retry(req("POST"), callCtx(id, pasted.id));
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("not_failed");
  });

  it("404s for a call of another session", async () => {
    const a = await createId({ question: "a" });
    const b = await createId({ question: "b" });
    await runner.drain();
    const call = listCallsForSession(db, b)[0]!;
    expect((await retry(req("POST"), callCtx(a, call.id))).status).toBe(404);
  });
});

describe("deleted list and restore", () => {
  it("lists deleted sessions and restores them with search", async () => {
    const id = await createId({ question: "zebra stripes" });
    await runner.drain();
    const items = async () =>
      ((await (await deletedList(req("GET"))).json()) as { data: { id: string }[] }).data;
    expect(await items()).toEqual([]);
    await deleteOne(req("DELETE"), idCtx(id));
    expect((await items()).map((i) => i.id)).toEqual([id]);

    expect((await restore(req("POST"), idCtx(id))).status).toBe(200);
    const l = (await (await list(new Request("http://x/api/sessions"))).json()) as {
      data: { id: string }[];
    };
    expect(l.data.map((i) => i.id)).toEqual([id]);
    expect(searchSessions(db, LOCAL_USER_ID, "zebra")).toHaveLength(1);
    expect((await restore(req("POST"), idCtx(id))).status).toBe(404);
  });

  it("hides everything from other users", async () => {
    const id = await createId({ question: "mine" });
    await runner.drain();
    const call = listCallsForSession(db, id)[0]!;
    await deleteOne(req("DELETE"), idCtx(id));
    userId = "someone-else";
    expect((await rerun(req("POST"), idCtx(id))).status).toBe(404);
    expect((await retry(req("POST"), callCtx(id, call.id))).status).toBe(404);
    expect((await restore(req("POST"), idCtx(id))).status).toBe(404);
    const d = (await (await deletedList(req("GET"))).json()) as { data: unknown[] };
    expect(d.data).toEqual([]);
  });
});
