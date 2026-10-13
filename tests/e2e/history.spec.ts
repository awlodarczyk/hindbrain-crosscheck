import { expect, test, type Page } from "@playwright/test";

const QUESTION = "Does static stretching before training reduce injury risk?";

async function createSession(page: Page): Promise<string> {
  const res = await page.request.post("/api/sessions", { data: { question: QUESTION } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function settledRow(page: Page, id: string) {
  const row = page.locator(`a[href="/s/${id}"]`);
  await expect(async () => {
    await page.reload();
    await expect(row).toBeVisible();
    await expect(row).not.toContainText("checking");
  }).toPass({ timeout: 30_000 });
  return row;
}

test("created session appears under Today with settled meta", async ({ page }) => {
  const id = await createSession(page);
  await page.goto("/");
  const row = await settledRow(page, id);
  await expect(page.getByRole("region", { name: "Today" })).toBeVisible();
  await expect(row).toContainText(/\d+ claims · \d+ disputed · /);
});

test("rename via the row menu persists after reload", async ({ page }) => {
  const id = await createSession(page);
  await page.goto("/");
  await settledRow(page, id);
  const wrapper = page.locator(`[data-history-row="${id}"]`);
  await wrapper.hover();
  await wrapper.getByRole("button", { name: /more actions/i }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const input = page.getByRole("textbox", { name: "Session title" });
  await input.fill(`Renamed ${id}`);
  const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.ok());
  await input.press("Enter");
  await saved;
  await expect(page.getByText(`Renamed ${id}`)).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Renamed ${id}`)).toBeVisible();
});

test("Meta+K search navigates to the session", async ({ page }) => {
  const id = await createSession(page);
  await page.goto("/");
  await settledRow(page, id);
  await page.keyboard.press("Meta+k");
  const box = page.getByPlaceholder("Search sessions…");
  await expect(box).toBeFocused();
  await box.fill("stretching");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/s\/[A-Za-z0-9]+/);
});

test("delete removes the row and shows a toast", async ({ page }) => {
  const id = await createSession(page);
  await page.goto("/");
  const row = await settledRow(page, id);
  const wrapper = page.locator(`[data-history-row="${id}"]`);
  await wrapper.hover();
  await wrapper.getByRole("button", { name: /more actions/i }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Session deleted")).toBeVisible();
  await expect(row).toHaveCount(0);
});
