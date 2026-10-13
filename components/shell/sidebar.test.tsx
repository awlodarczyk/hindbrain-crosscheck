import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HistoryItem } from "./group-by-day";
import { Sidebar, type SidebarProps } from "./sidebar";
import { useShortcuts } from "./use-shortcuts";

const now = new Date(2026, 5, 15, 12);
const mk = (id: string, question: string, d: Date): HistoryItem => ({
  id,
  question,
  status: "done",
  claims: 2,
  disputed: 0,
  callsDone: 4,
  callsTotal: 4,
  createdAt: d.toISOString(),
});
const items = [
  mk("a", "Alpha question", new Date(2026, 5, 15, 9)),
  mk("b", "Beta question", new Date(2026, 5, 14, 9)),
];

function setup(over: Partial<SidebarProps> = {}) {
  const props: SidebarProps = {
    items,
    activeId: "a",
    onNew: vi.fn(),
    onSearch: vi.fn(),
    onNavigate: vi.fn(),
    statusLine: { mode: "local", host: "127.0.0.1:4173", keys: true },
    now,
    ...over,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe("Sidebar", () => {
  it("renders groups, rows and status line", () => {
    setup();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Alpha question")).toBeInTheDocument();
    expect(screen.getByText(/Local · 127.0.0.1:4173 · keys/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings");
  });
  it("renders hosted and no-keys status lines", () => {
    setup({ statusLine: { mode: "hosted", host: "x.example", keys: false } });
    expect(screen.getByText(/Hosted · x.example/)).toBeInTheDocument();
  });
  it("calls onNavigate on row click", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("link", { name: /Beta question/ }));
    expect(p.onNavigate).toHaveBeenCalledWith("b");
  });
  it("calls onNew and onSearch", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /New question/ }));
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(p.onNew).toHaveBeenCalledOnce();
    expect(p.onSearch).toHaveBeenCalledOnce();
  });
  it("renders only chrome when empty", () => {
    setup({ items: [], activeId: null });
    expect(screen.queryByText("Today")).toBeNull();
    expect(screen.getByRole("button", { name: "Switch workspace" })).toBeInTheDocument();
  });
});

function Harness(h: Parameters<typeof useShortcuts>[0]) {
  useShortcuts(h);
  return <input aria-label="field" />;
}

describe("useShortcuts", () => {
  it("handles meta+k, meta+n and j/k", async () => {
    const h = { onSearch: vi.fn(), onNew: vi.fn(), onNext: vi.fn(), onPrev: vi.fn() };
    render(<Harness {...h} />);
    const u = userEvent.setup();
    await u.keyboard("{Meta>}k{/Meta}");
    await u.keyboard("{Meta>}n{/Meta}");
    await u.keyboard("j");
    await u.keyboard("k");
    expect(h.onSearch).toHaveBeenCalledOnce();
    expect(h.onNew).toHaveBeenCalledOnce();
    expect(h.onNext).toHaveBeenCalledOnce();
    expect(h.onPrev).toHaveBeenCalledOnce();
  });
  it("ignores j/k while typing in an input", async () => {
    const h = { onNext: vi.fn(), onPrev: vi.fn() };
    render(<Harness {...h} />);
    const u = userEvent.setup();
    await u.click(screen.getByLabelText("field"));
    await u.keyboard("jk");
    expect(h.onNext).not.toHaveBeenCalled();
    expect(h.onPrev).not.toHaveBeenCalled();
  });
});
