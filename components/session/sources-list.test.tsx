import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeDetail } from "./fixtures";
import { selectLatest } from "./select-bundle";
import { SourcesList } from "./sources-list";

describe("SourcesList", () => {
  it("lists each url once with citedBy badges", () => {
    const v = selectLatest(makeDetail());
    const calls = [...Object.values(v.answers), ...Object.values(v.reviews)].flatMap((c) =>
      c ? [c] : [],
    );
    render(<SourcesList calls={calls} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const first = within(items[0]!);
    expect(first.getByRole("link", { name: "https://www.nasa.gov/moon" })).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    );
    expect(first.getByText("Claude answer")).toBeInTheDocument();
    expect(first.getByText("ChatGPT answer")).toBeInTheDocument();
  });
  it("shows an empty state", () => {
    render(<SourcesList calls={[]} />);
    expect(screen.getByText("No sources cited.")).toBeInTheDocument();
  });
});
