import { expect, test } from "@playwright/test";

test("hosted responses carry HSTS and upgrade-insecure-requests", async ({ request }) => {
  const res = await request.get("/login");
  expect(res.headers()["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
  expect(res.headers()["content-security-policy"]).toContain("upgrade-insecure-requests");
});
