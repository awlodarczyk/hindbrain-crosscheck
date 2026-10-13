import { render, screen } from "@testing-library/react";
import { ListChecks } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatTile } from "./stat-tile";

describe("StatTile", () => {
  it("renders compact and full labels and keeps the full one in the accessible name", () => {
    render(<StatTile icon={ListChecks} label="Claims checked" shortLabel="Claims" value={11} />);
    expect(screen.getByRole("group", { name: "Claims checked: 11" })).toBeInTheDocument();
    expect(screen.getByText("Claims")).toHaveClass("md:hidden");
    expect(screen.getByText("Claims checked")).toHaveClass("hidden", "md:inline");
  });

  it("shows a dash while pending", () => {
    render(<StatTile icon={ListChecks} label="Disputed" value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
