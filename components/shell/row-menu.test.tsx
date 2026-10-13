import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HistoryItem } from "./group-by-day";
import { RowMenu } from "./row-menu";

const item: HistoryItem = {
  id: "s1",
  question: "Is the moon cheese?",
  status: "done",
  claims: 1,
  disputed: 0,
  callsDone: 1,
  callsTotal: 1,
  createdAt: new Date().toISOString(),
};

async function openMenu(name: string) {
  const trigger = screen.getByRole("button", { name: /more actions/i });
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

describe("RowMenu", () => {
  it("renames with a trimmed title on Enter", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    render(<RowMenu item={item} onRename={onRename} onDelete={vi.fn()} />);
    await openMenu("Rename");
    const input = await screen.findByRole("textbox", { name: "Session title" });
    expect(input).toHaveValue("Is the moon cheese?");
    fireEvent.change(input, { target: { value: "  New name  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onRename).toHaveBeenCalledWith("s1", "New name"));
  });

  it("ignores empty titles and cancels on Escape", async () => {
    const onRename = vi.fn();
    render(<RowMenu item={item} onRename={onRename} onDelete={vi.fn()} />);
    await openMenu("Rename");
    const input = await screen.findByRole("textbox", { name: "Session title" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
  });

  it("deletes after confirmation", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<RowMenu item={item} onRename={vi.fn()} onDelete={onDelete} />);
    await openMenu("Delete");
    expect(await screen.findByText("Delete this session?")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("s1"));
  });
});
