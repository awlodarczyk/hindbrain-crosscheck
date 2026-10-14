import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { createBus } from "@/lib/jobs/bus";
import { createRunner, type Runner } from "@/lib/jobs/runner";
import { createMockProvider } from "@/lib/providers/mock";
import { listCallsForSession } from "@/lib/repos/calls";
import { searchSessions } from "@/lib/repos/search";
import { getSession, softDeleteAllSessions } from "@/lib/repos/sessions";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { DELETE as deleteAll, GET as list, POST as create } from "@/app/api/sessions/route";
import { DELETE as deleteOne, GET as detail, PATCH as rename } from "@/app/api/sessions/[id]/route";

let db: Db;
let runner: Runner;
const allow = {
  consume: async () => ({ allowed: true, retryAfterSec: 0, remaining: 99, layer: null }),
};

const json = (method: string, body?: unknown) =>
  new Request("http://x/api/sessions", {
    method,
    headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = async (body: unknown) => create(json("POST", body));
const createId = async (body: unknown): Promise<string> =>
  ((await (await post(body)).json()) as { data: { id: string } }).data.id;

beforeEach(() => {
  db = createTestDb();
  ensureLocalUser(db);
  const bus = createBus();
  runner = createRunner({
    db,
    bus,
    providersFor: async () => ({
      claude: createMockProvider("claude"),
      chatgpt: createMockProvider("chatgpt"),
    }),
    settingsFor: () => DEFAULT_SETTINGS,
  });
  setDepsForTests({
    db,
    runner,
    bus,
    limiter: allow,
    auth: async () => ({ userId: LOCAL_USER_ID }),
  });
});
afterEach(() => resetDepsForTests());

describe("sessions api", () => {
  it("creates (201), runs, and exposes detail and list stats", async () => {
    const res = await post({ question: "Does stretching help?" });
    expect(res.status).toBe(201);
    const id = ((await res.json()) as { ok: boolean; data: { id: string } }).data.id;
    await runner.drain();

    const d = (await (await detail(json("GET"), ctx(id))).json()) as {
      data: { session: { status: string }; calls: unknown[]; claims: unknown[] };
    };
    expect(d.data.session.status).toBe("done");
    expect(d.data.calls).toHaveLength(4);
    expect(d.data.claims).toHaveLength(8);

    const l = (await (await list(new Request("http://x/api/sessions?limit=10"))).json()) as {
      data: unknown[];
      meta: { total: number; limit: number };
    };
    expect(l.data).toEqual([
      expect.objectContaining({ id, claims: 8, disputed: 2, callsDone: 4, callsTotal: 4 }),
    ]);
    expect(l.meta).toMatchObject({ total: 1, limit: 10 });
  });

  it("lists newest first and honours before", async () => {
    const a = await createId({ question: "first" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createId({ question: "second" });
    await runner.drain();
    const ids = async (qs: string) =>
      (
        (await (await list(new Request(`http://x/api/sessions${qs}`))).json()) as {
          data: { id: string; createdAt: string }[];
        }
      ).data;
    const all = await ids("");
    expect(all.map((i) => i.id)).toEqual([b, a]);
    expect(
      (await ids(`?before=${encodeURIComponent(`${all[0]!.createdAt}|${all[0]!.id}`)}`)).map(
        (i) => i.id,
      ),
    ).toEqual([a]);
  });

  it("imports a single pasted answer", async () => {
    const id = await createId({ question: "q", mode: "paste", pasted: { claude: "Some answer." } });
    await runner.drain();
    const calls = listCallsForSession(db, id);
    expect(calls).toHaveLength(2);
    expect(calls.filter((c) => c.pasted)).toHaveLength(1);
  });

  it("imports a transcript, titles it by its first line and feeds it to both models", async () => {
    const transcript = "\nUser: Is creatine safe for teenagers?\nAssistant: Absolutely, no limits.";
    const id = await createId({ mode: "transcript", transcript });
    await runner.drain();
    const s = getSession(db, LOCAL_USER_ID, id);
    expect(s).toMatchObject({
      mode: "transcript",
      transcript: transcript.trim(),
      title: "User: Is creatine safe for teenagers?",
      question: "Which claims in this conversation hold up?",
    });
    const calls = listCallsForSession(db, id);
    expect(calls).toHaveLength(4);
    expect(calls.some((c) => c.pasted)).toBe(false);
    expect(searchSessions(db, LOCAL_USER_ID, "teenagers").map((h) => h.id)).toEqual([id]);
  });

  it("validates input", async () => {
    for (const body of [
      { question: "" },
      { question: "x".repeat(8001) },
      { question: "q", mode: "paste" },
      { mode: "transcript" },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        "validation_failed",
      );
    }
  });

  it("renames, then soft-deletes and clears the search index", async () => {
    const id = await createId({ question: "zebra stripes" });
    await runner.drain();
    const r = await rename(json("PATCH", { title: "Zebras" }), ctx(id));
    expect(r.status).toBe(200);
    const l = (await (await list(new Request("http://x/api/sessions"))).json()) as {
      data: { question: string }[];
    };
    expect(l.data[0]?.question).toBe("Zebras");

    expect(searchSessions(db, LOCAL_USER_ID, "zebra")).toHaveLength(1);
    expect((await deleteOne(json("DELETE"), ctx(id))).status).toBe(200);
    expect((await detail(json("GET"), ctx(id))).status).toBe(404);
    expect((await deleteOne(json("DELETE"), ctx(id))).status).toBe(404);
    expect(searchSessions(db, LOCAL_USER_ID, "zebra")).toEqual([]);
  });

  it("deletes all only with confirmation", async () => {
    await createId({ question: "one" });
    await createId({ question: "two" });
    await runner.drain();
    expect((await deleteAll(json("DELETE", { confirm: "nope" }))).status).toBe(400);
    const res = await deleteAll(json("DELETE", { confirm: "DELETE" }));
    expect(((await res.json()) as { data: { deleted: number } }).data.deleted).toBe(2);
    const l = (await (await list(new Request("http://x/api/sessions"))).json()) as {
      data: unknown[];
    };
    expect(l.data).toEqual([]);
  });

  it("hides sessions from other users", async () => {
    const id = await createId({ question: "mine" });
    setDepsForTests({ auth: async () => ({ userId: "other" }) });
    expect((await detail(json("GET"), ctx(id))).status).toBe(404);
    expect(softDeleteAllSessions(db, "other")).toEqual([]);
  });
});
