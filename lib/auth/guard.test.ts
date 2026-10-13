import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { getUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { createLocalAuth } from "./guard";

describe("local auth", () => {
  it("resolves the local user and creates its row once", async () => {
    const db = createTestDb();
    const auth = createLocalAuth(db);
    const req = new Request("http://localhost/");
    expect(await auth(req)).toEqual({ userId: LOCAL_USER_ID });
    expect(await auth(req)).toEqual({ userId: LOCAL_USER_ID });
    expect(getUser(db, LOCAL_USER_ID)?.id).toBe(LOCAL_USER_ID);
  });
});
