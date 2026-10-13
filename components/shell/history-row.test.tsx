import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HistoryItem } from "./group-by-day";
import { HistoryRow } from "./history-row";

const item: HistoryItem = {
  id: "s1",
  question: "Is the moon made of cheese?",
  status: "done",
  claims: 11,
  disputed: 3,
  callsDone: 4,
  callsTotal: 4,
  createdAt: new Date(2026, 5, 15, 14, 32).toISOString(),
};

describe("HistoryRow", () => {
  it("renders question and meta", () => {
    render(<HistoryRow item={item} active={false} href="/s/s1" />);
    expect(screen.getByText("Is the moon made of cheese?")).toBeInTheDocument();
    expect(screen.getByText("11 claims · 3 disputed · 14:32")).toBeInTheDocument();
    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current");
  });
  it("renders running variant with pulsing dot", () => {
    const { container } = render(
      <HistoryRow
        item={{ ...item, status: "running", callsDone: 2 }}
        active={false}
        href="/s/s1"
      />,
    );
    expect(screen.getByText("checking · 2 of 4 calls")).toBeInTheDocument();
    expect(container.querySelector(".bg-status-running")).toHaveClass("animate-pulse");
  });
  it("marks active", () => {
    render(<HistoryRow item={item} active href="/s/s1" />);
    const a = screen.getByRole("link");
    expect(a).toHaveAttribute("aria-current", "page");
    expect(a).toHaveClass("bg-bg-selected");
  });
  it("uses disputed colour when disputed > 0", () => {
    const { container } = render(<HistoryRow item={item} active={false} href="/s/s1" />);
    expect(container.querySelector(".bg-status-disputed")).not.toBeNull();
  });
  it("uses supported colour when none disputed", () => {
    const { container } = render(
      <HistoryRow item={{ ...item, disputed: 0 }} active={false} href="/s/s1" />,
    );
    expect(container.querySelector(".bg-status-supported")).not.toBeNull();
  });
});
