import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CollapsibleCard } from "./collapsible-card";

describe("CollapsibleCard", () => {
  it("is always open without a toggle when not collapsible", () => {
    render(
      <CollapsibleCard header={<span>Head</span>}>
        <p>body</p>
      </CollapsibleCard>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("body")).toBeVisible();
  });

  it("toggles aria-expanded from a 44 px header button", async () => {
    render(
      <CollapsibleCard collapsible header={<span>Head</span>}>
        <p>body</p>
      </CollapsibleCard>,
    );
    const btn = screen.getByRole("button", { name: /Head/ });
    expect(btn).toHaveClass("min-h-11");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("body")).not.toBeVisible();
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body")).toBeVisible();
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("honours defaultOpen", () => {
    render(
      <CollapsibleCard collapsible defaultOpen header={<span>Head</span>}>
        <p>body</p>
      </CollapsibleCard>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });
});
