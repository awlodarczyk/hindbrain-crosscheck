import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import type { SettingsView } from "@/lib/api/settings-dto";
import { SettingsSchema } from "@/lib/settings/schema";
import { ModelsView } from "./models-view";
import { SettingsProvider } from "./settings-context";

vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api/client", async (orig) => {
  const mod = await orig<typeof import("@/lib/api/client")>();
  return {
    ...mod,
    api: { settings: { put: vi.fn(), get: vi.fn(), testProvider: vi.fn() } },
  };
});

const none = { source: "none", effective: "none", masked: null, valid: null, updatedAt: null };
const cli = { found: false, checkedAt: "2026-01-01T00:00:00Z" };
const models = [{ id: "m-1", label: "M1" }];
const view = {
  settings: SettingsSchema.parse({
    providers: {
      claude: { connection: "cli", answerModel: "m-1" },
      chatgpt: { answerModel: "m-1" },
    },
  }),
  warnings: [],
  secrets: { claude: none, chatgpt: none },
  cli: { claude: cli, codex: cli },
  cliAllowed: true,
  estimate: { low: 0.18, high: 0.31 },
  models: { claude: models, chatgpt: models },
  savedAt: null,
  mode: "local",
  transportMode: "mock",
} as unknown as SettingsView;
const test = api.settings.testProvider as unknown as ReturnType<typeof vi.fn>;

const mount = () =>
  render(
    <SettingsProvider view={view} dataDir={null}>
      <ModelsView />
    </SettingsProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  (api.settings.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ savedAt: null });
});

describe("ModelsView", () => {
  it("renders both providers, the estimate and few-shot summary", () => {
    mount();
    expect(screen.getAllByRole("heading", { name: "Models" })[0]).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Claude" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ChatGPT" })).toBeInTheDocument();
    expect(screen.getByText("≈ $0.18 → $0.31 per question")).toBeInTheDocument();
    expect(screen.getByText("No examples")).toBeInTheDocument();
  });

  it("binds a control to the settings state", async () => {
    mount();
    await userEvent.click(screen.getByRole("radio", { name: "Lenient" }));
    expect(screen.getByRole("radio", { name: "Lenient" })).toBeChecked();
    expect(screen.getByText(/^Lenient: /)).toBeInTheDocument();
  });

  it("toasts the provider test result", async () => {
    test.mockResolvedValueOnce({ ok: true, transport: "claude-cli", detail: "all good" });
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(await screen.findByRole("button", { name: "Test" })).toBeInTheDocument();
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("all good"));
    test.mockResolvedValueOnce({ ok: false, transport: "claude-cli", detail: "not found" });
    await userEvent.click(screen.getByRole("button", { name: "Test" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("not found"));
    test.mockRejectedValueOnce(new Error("boom"));
    await userEvent.click(screen.getByRole("button", { name: "Test" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
  });

  it("resets to defaults after confirmation", async () => {
    mount();
    await userEvent.click(screen.getByRole("radio", { name: "Thorough" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("radio", { name: "Balanced" })).toBeChecked();
  });

  it("updates tuning controls", async () => {
    mount();
    const slider = screen.getByRole("slider", { name: "Temperature" });
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("0.25")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Deep" }));
    expect(screen.getByRole("radio", { name: "Deep" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Max" }));
    expect(screen.getByRole("radio", { name: "Max" })).toBeChecked();
    await userEvent.click(screen.getByRole("switch", { name: "Re-run on disagreement" }));
    expect(screen.getByRole("switch", { name: "Re-run on disagreement" })).toBeChecked();
    await userEvent.type(screen.getByLabelText("Custom instructions"), "hi");
    expect(screen.getByText("2 / 1,000 characters")).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Max searches" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Max searches" }), "5");
    expect(screen.getByRole("spinbutton", { name: "Max searches" })).toHaveValue(5);
  });

  it("manages domains and few-shot examples", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Add domain" }));
    await userEvent.type(screen.getByLabelText("Domain"), "nih.gov{Enter}");
    expect(screen.getByRole("button", { name: "Remove nih.gov" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit examples" }));
    await userEvent.click(screen.getByRole("button", { name: "Add example" }));
    await userEvent.type(screen.getByLabelText("Question 1"), "q");
    await userEvent.type(screen.getByLabelText("Answer 1"), "a");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("1 example")).toBeInTheDocument();
  });

  it("changes models and the verification fallback", async () => {
    mount();
    await userEvent.click(screen.getByRole("combobox", { name: "ChatGPT verification model" }));
    await userEvent.click(await screen.findByRole("option", { name: "same as answer model" }));
    expect(screen.getByRole("combobox", { name: "ChatGPT verification model" })).toHaveTextContent(
      "same as answer model",
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Claude answer model" }));
    await userEvent.click(await screen.findByRole("option", { name: "m-1" }));
  });
});
