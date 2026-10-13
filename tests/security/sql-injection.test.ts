import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { GET as search } from "@/app/api/search/route";
import { PATCH as rename } from "@/app/api/sessions/[id]/route";
import { POST as create } from "@/app/api/sessions/route";
import { ctx } from "../helpers/route-ctx";
import { installHarness, newUser, sameOrigin, uninstallHarness, type Harness } from "./harness";

let h: Harness;
let user: string;
beforeEach(() => {
  h = installHarness();
  user = newUser(h.db, "a@example.com");
  h.as(user);
});
afterEach(uninstallHarness);

const tables = () =>
  h.db
    .all<{ name: string }>(sql`select name from sqlite_master where type in ('table')`)
    .map((r) => r.name);

describe("sql injection", () => {
  it.each(["' OR 1=1 --", '"); DROP TABLE sessions; --', "a' UNION SELECT * FROM users --"])(
    "search q=%s returns an empty list",
    async (q) => {
      const res = await search(sameOrigin(`http://x/api/search?q=${encodeURIComponent(q)}`), ctx());
      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
      expect(tables()).toContain("sessions");
    },
  );

  it("stores a hostile title verbatim and keeps the schema and FTS index intact", async () => {
    const made = await create(
      sameOrigin("http://x/api/sessions", "POST", { question: "zebra?" }),
      ctx(),
    );
    const id = (await made.json()).data.id as string;
    await h.runner.drain();
    const title = "'; DROP TABLE sessions;--";
    const res = await rename(
      sameOrigin(`http://x/api/sessions/${id}`, "PATCH", { title }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    const row = h.db.all<{ title: string }>(sql`select title from sessions where id = ${id}`);
    expect(row[0]?.title).toBe(title);
    expect(tables()).toEqual(expect.arrayContaining(["sessions", "sessions_fts"]));
    const hit = await search(sameOrigin("http://x/api/search?q=zebra"), ctx());
    expect((await hit.json()).data).toHaveLength(1);
  });
});
