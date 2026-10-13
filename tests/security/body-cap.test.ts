import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as create } from "@/app/api/sessions/route";
import { ctx } from "../helpers/route-ctx";
import { installHarness, newUser, uninstallHarness } from "./harness";

beforeEach(() => {
  const h = installHarness();
  h.as(newUser(h.db, "a@example.com"));
});
afterEach(uninstallHarness);

const CHUNK = 10_000;

/** Chunked body with no content-length; `pulls()` reports how many chunks were requested. */
function chunkedRequest(totalBytes: number) {
  const total = totalBytes / CHUNK;
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= total) return controller.close();
      pulled += 1;
      controller.enqueue(new TextEncoder().encode("a".repeat(CHUNK)));
    },
  });
  const req = new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
  return { req, pulls: () => pulled, total };
}

describe("request body cap", () => {
  it("accepts a chunked body under the route cap (rejected later by the schema, not 413)", async () => {
    const { req } = chunkedRequest(300_000);
    expect((await create(req, ctx())).status).toBe(400);
  });

  it("returns 413 for an oversized chunked body without reading it all", async () => {
    const { req, pulls, total } = chunkedRequest(600_000);
    const res = await create(req, ctx());
    expect(res.status).toBe(413);
    expect(pulls()).toBeLessThan(total);
  });
});
