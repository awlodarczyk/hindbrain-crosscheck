import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as search } from "@/app/api/search/route";
import { GET as events } from "@/app/api/sessions/[id]/events/route";
import { GET as exportOne } from "@/app/api/sessions/[id]/export/route";
import { POST as rerun } from "@/app/api/sessions/[id]/rerun/route";
import { POST as restore } from "@/app/api/sessions/[id]/restore/route";
import { DELETE as del, GET as detail, PATCH as patch } from "@/app/api/sessions/[id]/route";
import { POST as retry } from "@/app/api/sessions/[id]/calls/[callId]/retry/route";
import { GET as deleted } from "@/app/api/sessions/deleted/route";
import { GET as list, POST as create } from "@/app/api/sessions/route";
import { ctx } from "../helpers/route-ctx";
import { installHarness, newUser, sameOrigin, uninstallHarness, type Harness } from "./harness";

let h: Harness;
let a: string;
let b: string;
let id: string;
let callId: string;
beforeEach(async () => {
  h = installHarness();
  a = newUser(h.db, "a@example.com");
  b = newUser(h.db, "b@example.com");
  h.as(a);
  const made = await create(
    sameOrigin("http://x/api/sessions", "POST", { question: "zebra?" }),
    ctx(),
  );
  id = (await made.json()).data.id;
  await h.runner.drain();
  const d = await (await detail(sameOrigin(`http://x/api/sessions/${id}`), ctx({ id }))).json();
  callId = d.data.calls[0].id;
  h.as(b);
});
afterEach(uninstallHarness);

const u = `http://x/api/sessions/`;
describe("cross-user isolation", () => {
  it("returns 404 on every per-session route for another user", async () => {
    const p = { id };
    const results = await Promise.all([
      detail(sameOrigin(`${u}${id}`), ctx(p)),
      patch(sameOrigin(`${u}${id}`, "PATCH", { title: "mine now" }), ctx(p)),
      rerun(sameOrigin(`${u}${id}/rerun`, "POST"), ctx(p)),
      retry(sameOrigin(`${u}${id}/calls/${callId}/retry`, "POST"), ctx({ id, callId })),
      exportOne(sameOrigin(`${u}${id}/export?format=json`), ctx(p)),
      exportOne(sameOrigin(`${u}${id}/export?format=md`), ctx(p)),
      restore(sameOrigin(`${u}${id}/restore`, "POST"), ctx(p)),
      events(sameOrigin(`${u}${id}/events`), ctx(p)),
      del(sameOrigin(`${u}${id}`, "DELETE"), ctx(p)),
    ]);
    expect(results.map((r) => r.status)).toEqual(Array(results.length).fill(404));
  });

  it("keeps the session out of the other user's list, search and trash", async () => {
    const l = await (await list(sameOrigin("http://x/api/sessions"), ctx())).json();
    expect(l.data.items ?? l.data).toEqual([]);
    const s = await (await search(sameOrigin("http://x/api/search?q=zebra"), ctx())).json();
    expect(s.data).toEqual([]);
    const t = await (await deleted(sameOrigin("http://x/api/sessions/deleted"), ctx())).json();
    expect(t.data.items ?? t.data).toEqual([]);
  });

  it("leaves the owner's session untouched after the attempts", async () => {
    await del(sameOrigin(`${u}${id}`, "DELETE"), ctx({ id }));
    h.as(a);
    const res = await detail(sameOrigin(`${u}${id}`), ctx({ id }));
    expect(res.status).toBe(200);
  });
});
