import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { createUser } from "@/lib/repos/users";
import { createHostedAuth } from "./hosted-guard";
import { createAuthSession } from "./session";

const req = (cookie?: string) => new Request("http://x/api", { headers: cookie ? { cookie } : {} });

describe("hosted guard", () => {
  const db = createTestDb();
  const user = createUser(db, { email: "a@example.test", passwordHash: "x" });
  const guard = createHostedAuth(() => db);

  it("resolves the user from the session cookie", async () => {
    const { token } = createAuthSession(db, user.id, { ip: "1.1.1.1", ua: null });
    expect(await guard(req(`a=b; hc_session=${token}`))).toMatchObject({
      userId: user.id,
      renewed: false,
      token,
    });
  });
  it("returns null without a valid cookie", async () => {
    expect(await guard(req())).toBeNull();
    expect(await guard(req("hc_session=bogus"))).toBeNull();
  });
});
