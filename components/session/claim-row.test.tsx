import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClaimRow } from "./claim-row";
import { makeClaim } from "./fixtures";

describe("ClaimRow", () => {
  it.each([
    ["supported", "Supported"],
    ["disputed", "Disputed"],
    ["partial", "Partial"],
    ["unverifiable", "Unverifiable"],
  ] as const)("labels %s", (verdict, label) => {
    render(<ClaimRow claim={makeClaim({ verdict })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
  it("tints disputed rows only", () => {
    const { container, rerender } = render(<ClaimRow claim={makeClaim({ verdict: "disputed" })} />);
    expect(container.firstElementChild).toHaveClass("bg-bg-disputed");
    rerender(<ClaimRow claim={makeClaim()} />);
    expect(container.firstElementChild).not.toHaveClass("bg-bg-disputed");
  });
  it("renders claim, note and a safe domain link", () => {
    render(<ClaimRow claim={makeClaim()} />);
    expect(screen.getByText("The moon orbits Earth")).toBeInTheDocument();
    expect(screen.getByText("Confirmed by NASA")).toBeInTheDocument();
    const a = screen.getByRole("link", { name: "nasa.gov" });
    expect(a).toHaveAttribute("href", "https://www.nasa.gov/moon");
    expect(a.getAttribute("rel")).toContain("noopener");
  });
  it("omits link and note when absent", () => {
    render(<ClaimRow claim={makeClaim({ sourceUrl: null, note: null })} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
