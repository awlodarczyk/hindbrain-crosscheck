import { expect, test } from "@playwright/test";

const ROUTES = [
  ["/settings/verification", "Verification"],
  ["/settings/appearance", "Appearance"],
  ["/settings/data", "Data"],
] as const;

for (const [path, name] of ROUTES) {
  test(`${path} renders its section and marks nav active`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2, name, exact: true }).first()).toBeVisible();
    const link = page.getByRole("navigation", { name: "Settings" }).getByRole("link", { name });
    await expect(link).toHaveAttribute("aria-current", "page");
  });
}

test("deleted session can be restored from settings", async ({ page }) => {
  const question = `Restore me ${Date.now()}`;
  const created = await page.request.post("/api/sessions", { data: { question } });
  const { data } = (await created.json()) as { data: { id: string } };
  expect((await page.request.delete(`/api/sessions/${data.id}`)).ok()).toBe(true);

  await page.goto("/settings/data");
  const deleted = page.getByRole("region", { name: "Deleted sessions" });
  await expect(deleted.getByText(question)).toBeVisible();
  await deleted.getByRole("button", { name: `Restore ${question}` }).click();
  await expect(deleted.getByText(question)).toHaveCount(0);

  const list = await page.request.get("/api/sessions");
  const body = (await list.json()) as { data: { id: string }[] };
  expect(body.data.map((s) => s.id)).toContain(data.id);
  await expect(page.getByRole("navigation", { name: "History" }).getByText(question)).toBeVisible();
});

test("reduce motion persists to other pages", async ({ page }) => {
  await page.goto("/settings/appearance");
  const saved = page.waitForResponse(
    (r) => r.request().method() === "PUT" && r.url().endsWith("/api/settings") && r.ok(),
  );
  const toggle = page.getByRole("switch", { name: "Reduce motion" });
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  await saved;
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/reduce-motion/);

  await page.goto("/settings/appearance");
  const reset = page.waitForResponse(
    (r) => r.request().method() === "PUT" && r.url().endsWith("/api/settings") && r.ok(),
  );
  await page.getByRole("switch", { name: "Reduce motion" }).click();
  await reset;
});
