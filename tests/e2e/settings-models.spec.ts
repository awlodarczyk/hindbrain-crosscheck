import { expect, test, type Page } from "@playwright/test";

type Body = { data: { settings: Record<string, any> } }; // eslint-disable-line @typescript-eslint/no-explicit-any

const stored = async (page: Page) =>
  ((await (await page.request.get("/api/settings")).json()) as Body).data.settings;

const saved = (page: Page) =>
  page.waitForResponse(
    (r) => r.request().method() === "PUT" && r.url().endsWith("/api/settings") && r.ok(),
  );

test.beforeEach(async ({ page }) => {
  const settings = await stored(page);
  const reset = {
    ...settings,
    providers: {
      claude: { ...settings.providers.claude, connection: "api" },
      chatgpt: { ...settings.providers.chatgpt, connection: "api" },
    },
    tuning: {
      ...settings.tuning,
      temperature: 0.2,
      preferredDomains: [],
      customInstructions: "",
    },
    verification: { strictness: "strict", requireSourcePerClaim: true, rerunOnDisagreement: false },
  };
  expect((await page.request.put("/api/settings", { data: reset })).ok()).toBe(true);
});

test("renders the heading and both provider cards", async ({ page }) => {
  await page.goto("/settings/models");
  await expect(page.getByRole("heading", { name: "Models" }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Claude" })).toBeVisible();
  await expect(page.getByRole("region", { name: "ChatGPT" })).toBeVisible();
});

test("strictness and temperature persist", async ({ page }) => {
  await page.goto("/settings/models");
  const put = saved(page);
  await page.getByRole("radio", { name: "Lenient" }).click();
  await page.getByRole("slider", { name: "Temperature" }).focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await put;
  await page.reload();
  const s = await stored(page);
  expect(s.verification.strictness).toBe("lenient");
  expect(s.tuning.temperature).toBeCloseTo(0.5, 5);
  await expect(page.getByRole("radio", { name: "Lenient" })).toBeChecked();
});

test("adds a preferred domain", async ({ page }) => {
  await page.goto("/settings/models");
  const put = saved(page);
  await page.getByRole("button", { name: "Add domain" }).click();
  await page.getByLabel("Domain", { exact: true }).fill("nih.gov");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Remove nih.gov" })).toBeVisible();
  await put;
  expect((await stored(page)).tuning.preferredDomains).toEqual(["nih.gov"]);
});

test("insert template fills the textarea and counter", async ({ page }) => {
  await page.goto("/settings/models");
  await expect(page.getByText(/^0 \/ 1,000 characters$/)).toBeVisible();
  await page.getByRole("button", { name: "Insert template" }).click();
  await expect(page.getByLabel("Custom instructions")).toHaveValue(/Prefer meta-analyses/);
  await expect(page.getByText(/^\d+ \/ 1,000 characters$/)).not.toHaveText("0 / 1,000 characters");
});

test("require a source toggle persists", async ({ page }) => {
  await page.goto("/settings/models");
  const put = saved(page);
  await page.getByRole("switch", { name: "Require a source per claim" }).click();
  await put;
  expect((await stored(page)).verification.requireSourcePerClaim).toBe(false);
});

test("CLI connection shows the Test button and a toast", async ({ page }) => {
  await page.goto("/settings/models");
  const claude = page.getByRole("region", { name: "Claude" });
  await claude.getByRole("radio", { name: "Claude Code CLI" }).click();
  await claude.getByRole("button", { name: "Test" }).click();
  await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
});

test("reset to defaults restores the temperature", async ({ page }) => {
  await page.goto("/settings/models");
  const put = saved(page);
  await page.getByRole("slider", { name: "Temperature" }).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await put;
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  const after = saved(page);
  await page.getByRole("dialog").getByRole("button", { name: "Reset" }).click();
  await after;
  expect((await stored(page)).tuning.temperature).toBeCloseTo(0.2, 5);
});
