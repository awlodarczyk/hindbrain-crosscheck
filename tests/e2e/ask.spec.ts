import { expect, test } from "@playwright/test";

const QUESTION = "Does static stretching before training reduce injury risk?";
const SESSION_URL = /\/s\/[0-9A-Z]{26}$/;

test("hero is visible and Meta+Enter submits the question", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ask once");
  await page.getByRole("textbox", { name: "Question" }).fill(QUESTION);
  await page.getByRole("textbox", { name: "Question" }).press("Meta+Enter");
  await expect(page).toHaveURL(SESSION_URL, { timeout: 30_000 });
});

test("paste mode creates a session with one pasted call", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Paste existing answers" }).click();
  await page.getByRole("textbox", { name: "Question" }).fill(QUESTION);
  await page.getByLabel("Claude's answer").fill("Stretching has little effect on injuries.");
  await page.getByRole("button", { name: /Ask & cross-check/ }).click();
  await expect(page).toHaveURL(SESSION_URL, { timeout: 30_000 });
  const id = page.url().split("/s/")[1] ?? "";
  await expect(async () => {
    const res = await page.request.get(`/api/sessions/${id}`);
    const body = (await res.json()) as {
      data: { session: { status: string }; calls: { pasted?: boolean }[] };
    };
    expect(body.data.session.status).toBe("done");
    expect(body.data.calls.filter((c) => c.pasted === true)).toHaveLength(1);
  }).toPass({ timeout: 30_000 });
});

test("transcript mode runs both columns and shows the imported conversation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Import a transcript" }).click();
  await page
    .getByLabel("Chat transcript")
    .fill("User: Does stretching prevent injuries?\nAssistant: Yes, it halves the risk.");
  await page.getByRole("button", { name: /Ask & cross-check/ }).click();
  await expect(page).toHaveURL(SESSION_URL, { timeout: 30_000 });
  await expect(page.getByText("Imported transcript")).toBeVisible();
  const id = page.url().split("/s/")[1] ?? "";
  await expect(async () => {
    const res = await page.request.get(`/api/sessions/${id}`);
    const body = (await res.json()) as {
      data: { session: { status: string; mode: string }; calls: unknown[] };
    };
    expect(body.data.session.mode).toBe("transcript");
    expect(body.data.session.status).toBe("done");
    expect(body.data.calls).toHaveLength(4);
  }).toPass({ timeout: 30_000 });
});

test("transcript mode normalises a pasted Claude export", async ({ page }) => {
  const claudeExport = JSON.stringify({
    uuid: "c1",
    chat_messages: [
      { sender: "human", text: "Does stretching prevent injuries?" },
      { sender: "assistant", text: "", content: [{ type: "text", text: "Not reliably." }] },
    ],
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "Import a transcript" }).click();
  await page.getByLabel("Chat transcript").fill(claudeExport);
  await page.getByRole("button", { name: /Ask & cross-check/ }).click();
  await expect(page).toHaveURL(SESSION_URL, { timeout: 30_000 });
  await page.locator("details summary", { hasText: "Imported transcript" }).click();
  await expect(page.locator("details pre")).toContainText(/^User: Does stretching/);
  await expect(page.getByText("chat_messages")).toHaveCount(0);
});
