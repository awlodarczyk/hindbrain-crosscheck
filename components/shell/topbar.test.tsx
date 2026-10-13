import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Topbar } from "./topbar";

describe("Topbar", () => {
  it("renders crumbs with separators and current page", () => {
    render(
      <Topbar
        crumbs={[{ label: "Workspace", href: "/" }, { label: "Session" }]}
        actions={<button>Re-run</button>}
      />,
    );
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Session")).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("/")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Re-run" })).toBeInTheDocument();
  });
});
