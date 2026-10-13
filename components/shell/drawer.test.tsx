import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Drawer } from "./drawer";

describe("Drawer", () => {
  it("renders a modal dialog with a title, close button and focus inside", () => {
    render(
      <Drawer open onOpenChange={() => {}} title="Navigation">
        <button>Inside</button>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Navigation")).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer open onOpenChange={onOpenChange} title="Navigation">
        <button>Inside</button>
      </Drawer>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing when closed", () => {
    render(
      <Drawer open={false} onOpenChange={() => {}} title="Navigation">
        <button>Inside</button>
      </Drawer>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
