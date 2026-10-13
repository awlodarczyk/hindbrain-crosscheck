import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Segmented } from "./segmented";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma", disabled: true },
] as const;

function setup(value: "a" | "b" | "c" = "a") {
  const onChange = vi.fn();
  render(<Segmented value={value} onChange={onChange} options={options} ariaLabel="Letters" />);
  return { onChange, user: userEvent.setup() };
}

describe("Segmented", () => {
  it("renders options as radios with the selected one checked", () => {
    setup();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange when another option is clicked", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("radio", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("moves selection with ArrowRight", async () => {
    const { onChange, user } = setup();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("does not call onChange when tabbing into the group", async () => {
    const { onChange, user } = setup();
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onChange exactly once per click", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("radio", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("skips disabled options and wraps with arrows", async () => {
    const { onChange, user } = setup("b");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("jumps with Home and End", async () => {
    const { onChange, user } = setup("b");
    await user.tab();
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  it("jumps to the last enabled option with End", async () => {
    const { onChange, user } = setup("a");
    await user.tab();
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("b");
  });

  it("ignores a click on the selected option", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("radio", { name: "Alpha" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not select a disabled option", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("radio", { name: "Gamma" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
