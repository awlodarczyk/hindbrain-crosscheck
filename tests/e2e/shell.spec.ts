import { expect, test } from "@playwright/test";

test("sidebar shows lockup and chrome", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByRole("complementary");
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByText("hindbrain")).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /New question/ })).toBeVisible();
});

test("Meta+N keeps URL at /", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Meta+n");
  await expect(page).toHaveURL(/\/$/);
});

test("first Tab lands inside the sidebar", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const inSidebar = await page.evaluate(() => document.activeElement?.closest("aside") !== null);
  expect(inSidebar).toBe(true);
});
