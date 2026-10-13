import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeDetail } from "./fixtures";
import { SessionMenu } from "./session-actions";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("SessionMenu", () => {
  it("opens a menu with re-run, copy and export behind a 44 px button", async () => {
    const onRerun = vi.fn().mockResolvedValue(undefined);
    render(<SessionMenu detail={makeDetail()} busy={false} onRerun={onRerun} />);
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveClass("min-h-11", "min-w-11");
    await userEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: /Copy report/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Export JSON/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: /Re-run/ }));
    expect(onRerun).toHaveBeenCalledTimes(1);
  });
});
