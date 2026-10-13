import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryItem } from "@/components/shell/group-by-day";
import { SessionListContext } from "@/components/shell/session-list-context";
import { DeletedList } from "./deleted-list";

const refresh = vi.fn().mockResolvedValue(undefined);
const renderList = () =>
  render(
    <SessionListContext.Provider value={{ upsert: vi.fn(), refresh }}>
      <DeletedList />
    </SessionListContext.Provider>,
  );

const m = vi.hoisted(() => ({
  listDeleted: vi.fn(),
  restore: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({
  api: { sessions: { listDeleted: m.listDeleted, restore: m.restore } },
}));
vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }));

const item = (id: string, question: string): HistoryItem => ({
  id,
  question,
  status: "done",
  claims: 1,
  disputed: 0,
  callsDone: 2,
  callsTotal: 2,
  createdAt: "2026-05-01T10:00:00.000Z",
});
const list = (items: HistoryItem[]) => ({
  items,
  meta: { total: items.length, page: 1, limit: 50 },
});

beforeEach(() => vi.clearAllMocks());

describe("DeletedList", () => {
  it("shows loading then rows", async () => {
    m.listDeleted.mockResolvedValue(list([item("a", "Is water wet?")]));
    renderList();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByText("Is water wet?")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    m.listDeleted.mockResolvedValue(list([]));
    renderList();
    expect(await screen.findByText("Nothing deleted")).toBeInTheDocument();
  });

  it("restores a row, removes it and refreshes the history list", async () => {
    m.listDeleted.mockResolvedValue(list([item("a", "One"), item("b", "Two")]));
    m.restore.mockResolvedValue({});
    renderList();
    await userEvent.click((await screen.findAllByRole("button", { name: /Restore/ }))[0]!);
    await waitFor(() => expect(screen.queryByText("One")).not.toBeInTheDocument());
    expect(m.restore).toHaveBeenCalledWith("a");
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(m.success).toHaveBeenCalledWith("Session restored");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the row and toasts when restore fails", async () => {
    m.listDeleted.mockResolvedValue(list([item("a", "One")]));
    m.restore.mockRejectedValue(new Error("boom"));
    renderList();
    await userEvent.click(await screen.findByRole("button", { name: /Restore/ }));
    await waitFor(() => expect(m.error).toHaveBeenCalledWith("boom"));
    expect(screen.getByText("One")).toBeInTheDocument();
  });

  it("shows an error state and Retry reloads", async () => {
    m.listDeleted.mockRejectedValueOnce("nope").mockResolvedValueOnce(list([item("a", "One")]));
    renderList();
    expect(await screen.findByText("Could not load deleted sessions.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing deleted")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("One")).toBeInTheDocument();
    expect(m.listDeleted).toHaveBeenCalledTimes(2);
  });

  it("restores only once on double click", async () => {
    m.listDeleted.mockResolvedValue(list([item("a", "One")]));
    m.restore.mockReturnValue(new Promise(() => undefined));
    renderList();
    const btn = await screen.findByRole("button", { name: /Restore/ });
    await userEvent.dblClick(btn);
    expect(m.restore).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
  });

  it("does not update state after unmount", async () => {
    let resolve: (v: ReturnType<typeof list>) => void = () => undefined;
    m.listDeleted.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = renderList();
    unmount();
    resolve(list([]));
    await Promise.resolve();
    expect(m.error).not.toHaveBeenCalled();
  });

  it("shows the deletion date when present", async () => {
    m.listDeleted.mockResolvedValue(
      list([{ ...item("a", "One"), deletedAt: "2026-05-03T09:00:00.000Z" }]),
    );
    renderList();
    expect(await screen.findByText("deleted 2026-05-03")).toBeInTheDocument();
  });
});
