import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiClientError } from "./client";

function stub(res: Response | Error) {
  const fn = vi.fn<typeof fetch>(async () => {
    if (res instanceof Error) throw res;
    return res.clone();
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("unwraps ok envelopes", async () => {
    stub(json({ ok: true, data: { id: "a" } }));
    await expect(api.sessions.get("a")).resolves.toEqual({ id: "a" });
  });

  it("list returns items and meta", async () => {
    const meta = { total: 1, page: 1, limit: 50 };
    const fn = stub(json({ ok: true, data: [{ id: "a" }], meta }));
    await expect(api.sessions.list({ limit: 5 })).resolves.toEqual({ items: [{ id: "a" }], meta });
    expect(fn.mock.calls[0]?.[0]).toBe("/api/sessions?limit=5");
  });

  it("maps error envelopes to ApiClientError", async () => {
    stub(json({ ok: false, error: { code: "not_found", message: "Nope", details: 1 } }, 404));
    const err = await api.sessions.get("x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 404, code: "not_found", message: "Nope", details: 1 });
  });

  it("maps non-JSON responses to bad_response", async () => {
    stub(new Response("<html>", { status: 502 }));
    await expect(api.sessions.get("x")).rejects.toMatchObject({
      status: 502,
      code: "bad_response",
    });
  });

  it("maps network failures to code network", async () => {
    stub(new TypeError("fetch failed"));
    await expect(api.sessions.get("x")).rejects.toMatchObject({ status: 0, code: "network" });
  });

  it("create sends a JSON body", async () => {
    const fn = stub(json({ ok: true, data: { id: "n" } }, 201));
    await api.sessions.create({ question: "Why?" });
    const [path, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/sessions");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ question: "Why?" }));
    expect(init.credentials).toBe("same-origin");
  });

  it("builds export urls", () => {
    expect(api.sessions.exportUrl("a", "md")).toBe("/api/sessions/a/export?format=md");
    expect(api.sessions.exportAllUrl()).toBe("/api/sessions/export");
  });

  it("uses the settings key routes", async () => {
    const fn = stub(json({ ok: true, data: {} }));
    await api.settings.putKey({ provider: "claude", apiKey: "k" });
    await api.settings.reveal({ provider: "claude" });
    await api.settings.removeKey("claude");
    const calls = fn.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([p, i]) => `${i.method} ${p}`)).toEqual([
      "PUT /api/settings/keys",
      "POST /api/settings/keys/reveal",
      "DELETE /api/settings/keys",
    ]);
  });

  it("search encodes the query", async () => {
    const fn = stub(json({ ok: true, data: [] }));
    await api.search("a b", 5);
    expect(fn.mock.calls[0]?.[0]).toBe("/api/search?q=a+b&limit=5");
  });

  it("importFile posts parsed JSON", async () => {
    const fn = stub(json({ ok: true, data: { imported: 1, ids: ["x"], warnings: [] } }));
    await api.sessions.importFile(new File(['{"a":1}'], "e.json"));
    const [path, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/sessions/import");
    expect(init.body).toBe('{"a":1}');
  });

  it("importFile rejects non-JSON files", async () => {
    stub(json({}));
    await expect(api.sessions.importFile(new File(["nope"], "e.json"))).rejects.toMatchObject({
      code: "bad_file",
    });
  });
});
