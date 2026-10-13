import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SettingsView } from "@/lib/api/settings-dto";
import { KeyField } from "./key-field";

type State = SettingsView["secrets"]["claude"];
const base: State = {
  source: "db",
  effective: "db",
  masked: "sk-ant-••••a92c",
  valid: null,
  updatedAt: null,
};
const setup = (state: State, over: Partial<Parameters<typeof KeyField>[0]> = {}) => {
  const props = {
    onReplace: vi.fn().mockResolvedValue(undefined),
    onReveal: vi.fn().mockResolvedValue("sk-ant-plain-secret"),
    onRemove: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(<KeyField provider="claude" state={state} {...props} />);
  return props;
};
afterEach(() => vi.useRealTimers());

describe("KeyField", () => {
  it("shows the masked value", () => {
    setup(base);
    expect(screen.getByText("sk-ant-••••a92c")).toBeInTheDocument();
  });

  it.each([
    [{ ...base, valid: null }, "Set"],
    [{ ...base, valid: true }, "Valid"],
    [{ ...base, valid: false, broken: true, masked: null }, "Invalid"],
    [{ ...base, source: "env", effective: "env", valid: true }, "Env"],
    [{ ...base, source: "none", effective: "none", masked: null }, "Not set"],
  ] as [State, string][])("badge %#", (state, text) => {
    setup(state);
    expect(screen.getByText(text, { selector: "span" })).toBeInTheDocument();
  });

  it("reveals plaintext then re-masks after 10 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const props = setup(base);
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: /reveal/i }));
    expect(props.onReveal).toHaveBeenCalled();
    expect(await screen.findByText("sk-ant-plain-secret")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByText("sk-ant-plain-secret")).not.toBeInTheDocument();
    expect(screen.getByText("sk-ant-••••a92c")).toBeInTheDocument();
  });

  it("validates min 20 chars in the replace dialog", async () => {
    const user = userEvent.setup();
    const props = setup(base);
    await user.click(screen.getByRole("button", { name: "Replace" }));
    const input = screen.getByLabelText(/api key/i);
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "off");
    await user.type(input, "short");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/at least 20/i)).toBeInTheDocument();
    expect(props.onReplace).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, "x".repeat(24));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onReplace).toHaveBeenCalledWith("x".repeat(24));
  });

  it("shows Remove only for stored keys", () => {
    setup({ ...base, source: "env", effective: "env" });
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });
  it("shows Remove for db keys", () => {
    setup(base);
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("clears the reveal timer on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup(base);
    const { unmount } = { unmount: () => cleanup() };
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: /reveal/i }));
    await screen.findByText("sk-ant-plain-secret");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("trims the key before validating and submitting", async () => {
    const user = userEvent.setup();
    const props = setup(base);
    await user.click(screen.getByRole("button", { name: "Replace" }));
    await user.type(screen.getByLabelText(/api key/i), `  ${"x".repeat(24)}  `);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onReplace).toHaveBeenCalledWith("x".repeat(24));
  });
});
