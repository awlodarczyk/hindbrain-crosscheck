import { expect, test } from "@playwright/test";

const QUESTION = "Does static stretching before training reduce injury risk?";

test("session streams running, done and error states live", async ({ page, baseURL }) => {
  const warm = await page.request.post("/api/sessions", {
    data: { question: QUESTION },
    headers: { origin: baseURL! },
  });
  const warmId = ((await warm.json()) as { data: { id: string } }).data.id;
  await page.goto(`/s/${warmId}`);
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Question" }).fill(QUESTION);
  await page.getByRole("textbox", { name: "Question" }).press("Meta+Enter");
  await expect(page).toHaveURL(/\/s\/[0-9A-Z]{26}$/, { timeout: 30_000 });

  const claude = page.getByRole("article", { name: "Claude answer" });
  const chatgpt = page.getByRole("article", { name: "ChatGPT answer" });
  const rerun = page.getByRole("button", { name: "Re-run" });

  await expect(claude).toContainText("is answering", { timeout: 10_000 });
  await expect(rerun).toBeDisabled();
  await expect(page.locator('a[aria-current="page"]')).toContainText(/checking · \d of \d calls/, {
    timeout: 10_000,
  });

  await expect(claude).not.toContainText("is answering", { timeout: 15_000 });
  await expect(claude).toContainText(/\d+\.\d s/);

  await expect(chatgpt.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 15_000 });
  await expect(chatgpt).toContainText("mock failure");
  await expect(rerun).toBeEnabled({ timeout: 15_000 });

  await chatgpt.getByRole("button", { name: "Retry" }).click();
  await expect(chatgpt).toContainText("is answering", { timeout: 5_000 });
  await expect(chatgpt.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 15_000 });
});
