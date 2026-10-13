import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-db";
import { resetDepsForTests, setDepsForTests } from "@/lib/http/deps";
import { createBus } from "@/lib/jobs/bus";
import { createRunner, type Runner } from "@/lib/jobs/runner";
import { ExportFileSchema } from "@/lib/pipeline/export-schema";
import { createMockProvider } from "@/lib/providers/mock";
import { searchSessions } from "@/lib/repos/search";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { GET as list, POST as create } from "@/app/api/sessions/route";
import { GET as exportOne } from "@/app/api/sessions/[id]/export/route";
import { GET as exportAll } from "@/app/api/sessions/export/route";
import { POST as importFile } from "@/app/api/sessions/import/route";
import { GET as search } from "@/app/api/search/route";

let db: Db;
let runner: Runner;
const allow = {
  consume: async () => ({ allowed: true, retryAfterSec: 0, remaining: 99, layer: null }),
};
const req = (url: string, init?: RequestInit) => new Request(`http://x${url}`, init);
const jsonPost = (url: string, body: string, type = "application/json") =>
  req(url, {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin", "content-type": type },
    body,
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function runSession(question: string): Promise<string> {
  const res = await create(jsonPost("/api/sessions", JSON.stringify({ question })));
  const id = ((await res.json()) as { data: { id: string } }).data.id;
  await runner.drain();
  return id;
}

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

describe("export", () => {
  it("exports markdown with the question and a claims table", async () => {
    const id = await runSession("Does stretching help?");
    const res = await exportOne(req(`/api/sessions/${id}/export?format=md`), ctx(id));
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain(`crosscheck-${id}.md`);
    const md = await res.text();
    expect(md).toContain("Does stretching help?");
    expect(md).toMatch(/\|.*\|/);
  });

  it("exports json that validates and omits userId and html", async () => {
    const id = await runSession("q json");
    const res = await exportOne(req(`/api/sessions/${id}/export`), ctx(id));
    expect(res.headers.get("content-disposition")).toContain(`crosscheck-${id}.json`);
    const text = await res.text();
    expect(ExportFileSchema.safeParse(JSON.parse(text)).success).toBe(true);
    expect(text).not.toContain("userId");
    expect(text).not.toContain('"html"');
  });

  it("exports all sessions and hides others' sessions", async () => {
    const id = await runSession("q all");
    const all = ExportFileSchema.parse(
      await exportAll(req("/api/sessions/export")).then((r) => r.json()),
    );
    expect(all.sessions).toHaveLength(1);
    setDepsForTests({ auth: async () => ({ userId: "other" }) });
    expect((await exportOne(req(`/api/sessions/${id}/export`), ctx(id))).status).toBe(404);
  });
});

describe("import", () => {
  it("round-trips an export into new sessions", async () => {
    const id = await runSession("Round trip question");
    const file = await (await exportOne(req(`/api/sessions/${id}/export`), ctx(id))).text();
    const res = await importFile(jsonPost("/api/sessions/import", file));
    const out = (await res.json()) as { data: { imported: number; ids: string[] } };
    expect(out.data.imported).toBe(1);
    expect(out.data.ids[0]).not.toBe(id);

    const l = (await (await list(req("/api/sessions"))).json()) as {
      data: { id: string; claims: number }[];
    };
    expect(l.data).toHaveLength(2);
    expect(l.data.find((i) => i.id === out.data.ids[0])?.claims).toBe(8);
    expect(searchSessions(db, LOCAL_USER_ID, "Round trip").map((h) => h.id)).toContain(
      out.data.ids[0],
    );
  });

  it("rejects wrong content type, oversized and invalid bodies", async () => {
    expect((await importFile(jsonPost("/api/sessions/import", "{}", "text/plain"))).status).toBe(
      415,
    );
    const big = JSON.stringify({ pad: "x".repeat(2_200_000) });
    expect((await importFile(jsonPost("/api/sessions/import", big))).status).toBe(413);
    const bad = await importFile(jsonPost("/api/sessions/import", '{"v":1}'));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe(
      "invalid_export_file",
    );
  });
});

describe("search", () => {
  it("finds by answer text with a mark, and survives injection strings", async () => {
    await runSession("Something unrelated");
    const answer = searchSessions(db, LOCAL_USER_ID, "Something").length;
    expect(answer).toBe(1);
    const inj = await search(req(`/api/search?q=${encodeURIComponent('") OR 1=1 --')}`));
    expect(inj.status).toBe(200);
    expect(((await inj.json()) as { data: unknown[] }).data).toEqual([]);
    const hit = (await (await search(req("/api/search?q=Something"))).json()) as {
      data: { snippet: string }[];
    };
    expect(hit.data[0]?.snippet).toContain("<mark>");
  });

  it("finds an imported session by answer text", async () => {
    const id = await runSession("Unrelated title");
    const file = JSON.parse(
      await (await exportOne(req(`/api/sessions/${id}/export`), ctx(id))).text(),
    ) as {
      sessions: { calls: { kind: string; text: string | null }[] }[];
    };
    const text = file.sessions[0]?.calls.find((c) => c.kind === "answer")?.text ?? "";
    const word = text.match(/[A-Za-z]{7,}/)?.[0] ?? "";
    expect(word).not.toBe("");
    await importFile(jsonPost("/api/sessions/import", JSON.stringify(file)));
    const res = (await (await search(req(`/api/search?q=${word}`))).json()) as {
      data: { snippet: string }[];
    };
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.some((h) => h.snippet.includes("<mark>"))).toBe(true);
  });
});
