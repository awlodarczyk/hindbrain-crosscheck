import { expect, test } from "@playwright/test";

test("home page is served under a strict nonce-based CSP without violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (m.text().includes("Content Security Policy")) violations.push(m.text());
  });
  const res = await page.goto("/");
  const headers = res?.headers() ?? {};
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  await page.waitForLoadState("networkidle");

  const html = (await res?.text()) ?? "";
  const tags = html.match(/<script\b[^>]*>/g) ?? [];
  expect(tags.length).toBeGreaterThan(0);
  expect(tags.filter((t) => !/\bnonce="[^"]+"/.test(t))).toEqual([]);
  expect(violations).toEqual([]);
});
