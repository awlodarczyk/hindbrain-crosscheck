import { expect, test, type Page } from "@playwright/test";

const QUESTION = "Does static stretching before training reduce injury risk?";

async function settledSession(page: Page, origin: string): Promise<string> {
  const res = await page.request.post("/api/sessions", {
    data: { question: QUESTION },
    headers: { origin },
  });
  expect(res.status()).toBe(201);
  const id = ((await res.json()) as { data: { id: string } }).data.id;
  await expect(async () => {
    const r = await page.request.get(`/api/sessions/${id}`);
    const body = (await r.json()) as { data: { session: { status: string } } };
    expect(body.data.session.status).toBe("done");
  }).toPass({ timeout: 30_000 });
  return id;
}

test("session screen shows question, stats and four cards", async ({ page, baseURL }) => {
  const id = await settledSession(page, baseURL!);
  await page.goto(`/s/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(QUESTION);
  await expect(page.getByRole("group", { name: "Claims checked: 8" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Supported: 6" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Disputed: 2" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
});

test("tabs: cross-check, sources and raw", async ({ page, baseURL }) => {
  const id = await settledSession(page, baseURL!);
  await page.goto(`/s/${id}`);
  await page.getByRole("tab", { name: "Cross-check" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByRole("tab", { name: /Sources/ }).click();
  await expect(page.getByRole("listitem").first()).toContainText("http");
  await page.getByRole("tab", { name: "Raw" }).click();
  await expect(page.locator("pre").first()).toBeVisible();
});

test("copy report writes markdown to the clipboard", async ({
  page,
  context,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== "chromium", "clipboard permissions are chromium-only");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const id = await settledSession(page, baseURL!);
  await page.goto(`/s/${id}`);
  await page.getByRole("button", { name: "Copy report" }).click();
  await expect(page.getByText("Report copied")).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith("# ")).toBe(true);
});

test("export JSON downloads a .json file", async ({ page, baseURL }) => {
  const id = await settledSession(page, baseURL!);
  await page.goto(`/s/${id}`);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

test("unknown session id renders 404", async ({ page }) => {
  const res = await page.goto("/s/unknown");
  expect(res?.status()).toBe(404);
});
