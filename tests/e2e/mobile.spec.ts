import { expect, test, type Page } from "@playwright/test";

test("sidebar is hidden until the menu opens the drawer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("complementary")).toHaveCount(0);
  const menu = page.getByRole("button", { name: "Open menu" });
  await expect(menu).toBeVisible();
  await menu.click();
  const dialog = page.getByRole("dialog", { name: "Navigation" });
  await expect(dialog.getByText("hindbrain")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("no horizontal scroll and 44px menu target", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open menu" });
  await expect(menu).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  const box = await menu.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

const QUESTION = "Does static stretching before training reduce injury risk?";

async function settledSession(page: Page): Promise<string> {
  const res = await page.request.post("/api/sessions", { data: { question: QUESTION } });
  expect(res.status()).toBe(201);
  const id = ((await res.json()) as { data: { id: string } }).data.id;
  await expect(async () => {
    const r = await page.request.get(`/api/sessions/${id}`);
    const body = (await r.json()) as { data: { session: { status: string } } };
    expect(body.data.session.status).toBe("done");
  }).toPass({ timeout: 30_000 });
  return id;
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("session: single column, collapsed cards, stacked claims, 44px send", async ({ page }) => {
  const id = await settledSession(page);
  await page.goto(`/s/${id}`);
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(4);
  expect(await noHorizontalScroll(page)).toBe(true);

  const toggles = cards.getByRole("button", { expanded: true });
  await expect(toggles).toHaveCount(1);
  await expect(cards.nth(0).getByRole("button")).toHaveAttribute("aria-expanded", "true");
  await expect(cards.nth(1).getByRole("button")).toHaveAttribute("aria-expanded", "false");

  const review = cards.nth(2);
  await review.getByRole("button").click();
  await expect(review.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  const row = review.locator("div.grid").first();
  const chip = await row.locator("span").first().boundingBox();
  const claim = await row.locator("p").first().boundingBox();
  expect(chip && claim && chip.y + chip.height <= claim.y).toBe(true);
  expect(await noHorizontalScroll(page)).toBe(true);

  const send = page.getByRole("button", { name: "Ask & cross-check" });
  const box = await send.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByPlaceholder("Ask a new question…")).toBeVisible();

  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: /Re-run/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
});

test("settings: nav chips scroll horizontally and the content fits", async ({ page }) => {
  await page.goto("/settings");
  const nav = page.getByRole("navigation", { name: "Settings" });
  await expect(nav).toBeVisible();
  await expect.poll(() => nav.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const last = nav.getByRole("link", { name: "Data" });
  await expect(async () => {
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
  }).toPass({ timeout: 30_000 });
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("empty page renders without overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Ask once/ })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("transcript session: collapsed summary opens labelled turns without overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Import a transcript" }).click();
  await page
    .getByLabel("Chat transcript")
    .fill("User: Does stretching prevent injuries?\nAssistant: Yes, it halves the risk.");
  await page.getByRole("button", { name: /Ask & cross-check/ }).click();
  await expect(page).toHaveURL(/\/s\/[\w-]+$/, { timeout: 30_000 });
  const summary = page.getByText("Imported transcript");
  await expect(summary).toBeVisible();
  await expect(page.locator("details")).not.toHaveAttribute("open");
  await summary.click();
  await expect(page.getByText("User", { exact: true })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
