import { expect, test } from "@playwright/test";

test("home renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("hindbrain crosscheck")).toBeVisible();
});

test("dark scheme applies dark class and background", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(9, 9, 11)");
});

test("light scheme has white background", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});
