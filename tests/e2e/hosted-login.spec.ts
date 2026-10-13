import { expect, test } from "@playwright/test";

const EMAIL = "admin@example.test";
const PASSWORD = "correct-horse-battery-staple";

async function signIn(page: import("@playwright/test").Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("anonymous visit redirects to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("wrong password shows the generic alert", async ({ page }) => {
  await signIn(page, "definitely-wrong-password");
  await expect(page.locator("form [role=alert]")).toHaveText("Email or password is incorrect.");
  await expect(page).toHaveURL(/\/login/);
});

test("login, session, and logout round trip", async ({ page }) => {
  await signIn(page, PASSWORD);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("complementary")).toBeVisible();

  const me = await page.request.get("/api/auth/me");
  expect((await me.json()).data.email).toBe(EMAIL);

  const out = await page.request.post("/api/auth/logout");
  expect(out.status()).toBe(200);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
