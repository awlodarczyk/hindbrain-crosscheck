import { expect, test, type Page } from "@playwright/test";

const DUMMY_KEY = `sk-test-${"x".repeat(32)}`;

async function saved(page: Page) {
  await page.waitForResponse(
    (r) => r.request().method() === "PUT" && r.url().endsWith("/api/settings") && r.ok(),
  );
}

test.beforeEach(async ({ page }) => {
  const res = await page.request.get("/api/settings");
  const { data } = (await res.json()) as { data: { settings: Record<string, unknown> } };
  const settings = {
    ...data.settings,
    appearance: { theme: "system", reduceMotion: false },
    cost: { maxSearchesPerCall: 8, timeoutSeconds: 300 },
  };
  expect((await page.request.put("/api/settings", { data: settings })).ok()).toBe(true);
});

test("renders heading, nav and local data path action", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Settings" });
  for (const name of ["General", "Models", "Verification", "Appearance", "Data"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Copy data path" })).toBeVisible();
});

test("dark theme applies and persists after reload", async ({ page }) => {
  await page.goto("/settings");
  const put = saved(page);
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await put;
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const reset = saved(page);
  await page.getByRole("radio", { name: "System" }).click();
  await reset;
});

test("max searches persists after reload", async ({ page }) => {
  await page.goto("/settings");
  const put = saved(page);
  await page.getByRole("spinbutton", { name: "Max searches per call" }).fill("12");
  await put;
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "Max searches per call" })).toHaveValue("12");
});

test("replace OpenAI key stores it and reveal shows it", async ({ page }) => {
  await page.goto("/settings");
  const group = page.getByRole("group", { name: "OpenAI credentials" });
  await group.getByRole("button", { name: "Replace" }).click();
  await page.getByLabel("OpenAI API key").fill(DUMMY_KEY);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(group.getByText("Set", { exact: true })).toBeVisible();
  const res = await page.request.get("/api/settings");
  const body = (await res.json()) as { data: { secrets: { chatgpt: { source: string } } } };
  expect(body.data.secrets.chatgpt.source).toBe("db");
  await group.getByRole("button", { name: "Reveal" }).click();
  await expect(group.getByText(DUMMY_KEY)).toBeVisible();
  await group.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).last().click();
  await expect(group.getByText("Not set")).toBeVisible();
});

test("delete all history needs DELETE and empties the sidebar", async ({ page }) => {
  const created = await page.request.post("/api/sessions", { data: { question: "Is water wet?" } });
  expect(created.status()).toBe(201);
  await page.goto("/settings");
  const history = page.getByRole("navigation", { name: "History" });
  await expect(history.getByRole("link").first()).toBeVisible();
  await page.getByRole("button", { name: "Delete all history" }).click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: "Delete all history" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await confirm.click();
  await expect(page.getByText("History deleted")).toBeVisible();
  await expect(history.getByRole("link")).toHaveCount(0);
});
