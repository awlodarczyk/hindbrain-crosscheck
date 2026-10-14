import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsSchema } from "@/lib/settings/schema";
import { makeView } from "@/components/empty/view-fixture";
import { Composer, type ComposerProps } from "./composer";

const view = makeView();
function setup(over: Partial<ComposerProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <Composer
      variant="centered"
      settings={SettingsSchema.parse({})}
      models={view.models}
      onSubmit={onSubmit}
      {...over}
    />,
  );
  return onSubmit;
}
const box = () => screen.getByRole("textbox", { name: "Question" });
const ask = () => screen.getByRole("button", { name: /Ask & cross-check/ });

describe("Composer", () => {
  it("submits the trimmed question on Meta+Enter", async () => {
    const onSubmit = setup();
    await userEvent.type(box(), "  why?  ");
    fireEvent.keyDown(box(), { key: "Enter", metaKey: true });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ question: "why?", mode: "ask" }));
  });

  it("keeps the button disabled while empty", async () => {
    setup();
    expect(ask()).toBeDisabled();
    await userEvent.type(box(), "x");
    expect(ask()).toBeEnabled();
  });

  it("paste mode needs one answer", async () => {
    const onSubmit = setup({ mode: "paste" });
    await userEvent.type(box(), "q");
    expect(ask()).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Claude's answer"), "a");
    expect(ask()).toBeEnabled();
    await userEvent.click(ask());
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        question: "q",
        mode: "paste",
        pasted: { claude: "a" },
      }),
    );
  });

  it("transcript mode needs only the transcript", async () => {
    const onSubmit = setup({ mode: "transcript" });
    expect(ask()).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Chat transcript"), " U: hi ");
    expect(ask()).toBeEnabled();
    await userEvent.click(ask());
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        question: "",
        mode: "transcript",
        transcript: "U: hi",
      }),
    );
  });

  it("transcript mode turns a pasted Claude export into turns and submits them", async () => {
    const onSubmit = setup({ mode: "transcript" });
    const exportJson = JSON.stringify({
      chat_messages: [
        { sender: "human", text: "Q?" },
        { sender: "assistant", text: "A." },
      ],
    });
    const field = screen.getByLabelText("Chat transcript");
    fireEvent.change(field, { target: { value: exportJson } });
    expect(field).toHaveValue("User: Q?\n\nAssistant: A.");
    await userEvent.click(ask());
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        question: "",
        mode: "transcript",
        transcript: "User: Q?\n\nAssistant: A.",
      }),
    );
  });

  it("clamps searches to 0-20 and emits the override", async () => {
    const onSubmit = setup();
    const n = screen.getByRole("spinbutton", { name: "Max searches" });
    fireEvent.change(n, { target: { value: "99" } });
    expect(n).toHaveValue(20);
    await userEvent.type(box(), "q");
    await userEvent.click(ask());
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        question: "q",
        mode: "ask",
        overrides: { cost: { maxSearchesPerCall: 20 } },
      }),
    );
  });

  it("emits a model override when changed", async () => {
    const onSubmit = setup();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Claude model" }),
      "claude-sonnet-5-5",
    );
    await userEvent.type(box(), "q");
    await userEvent.click(ask());
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        question: "q",
        mode: "ask",
        overrides: { providers: { claude: { answerModel: "claude-sonnet-5-5" } } },
      }),
    );
  });

  it("shows disabledLabel and blocks submit", () => {
    setup({ disabled: true, disabledLabel: "Connect a provider first" });
    expect(screen.getByRole("button", { name: "Connect a provider first" })).toBeDisabled();
  });

  it("marks the docked variant", () => {
    setup({ variant: "docked" });
    expect(document.querySelector('[data-variant="docked"]')).not.toBeNull();
  });

  it("uses the short placeholder when docked and the long one while disabled", () => {
    setup({ variant: "docked" });
    expect(box()).toHaveAttribute("placeholder", "Ask a new question…");
  });

  it("keeps the running placeholder while disabled", () => {
    setup({ variant: "docked", disabled: true, disabledPlaceholder: "Running… wait" });
    expect(box()).toHaveAttribute("placeholder", "Running… wait");
  });

  it("submits once when triggered twice before the first resolves", async () => {
    let release!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (release = r)));
    setup({ onSubmit });
    await userEvent.type(box(), "q");
    fireEvent.keyDown(box(), { key: "Enter", metaKey: true });
    fireEvent.keyDown(box(), { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    release();
  });

  it("renders a round 44 px send button when docked on a narrow screen", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    const onSubmit = setup({ variant: "docked" });
    await userEvent.type(box(), "q");
    const send = ask();
    expect(send).toHaveClass("size-11", "rounded-full");
    await userEvent.click(send);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });
});
