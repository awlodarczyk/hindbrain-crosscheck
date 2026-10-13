import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileTopbar } from "./mobile-topbar";

describe("MobileTopbar", () => {
  it("renders the title and calls onMenu from a 44px button", async () => {
    const onMenu = vi.fn();
    render(
      <MobileTopbar title="hindbrain crosscheck" onMenu={onMenu} actions={<span>act</span>} />,
    );
    expect(screen.getByText("hindbrain crosscheck")).toBeInTheDocument();
    expect(screen.getByText("act")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Open menu" });
    expect(btn).toHaveClass("min-h-11", "min-w-11");
    await userEvent.click(btn);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });
});
