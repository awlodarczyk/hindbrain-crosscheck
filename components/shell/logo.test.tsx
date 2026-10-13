import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("gives each instance a unique clipPath id", () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    );
    const ids = [...container.querySelectorAll("clipPath")].map((c) => c.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
  it("hides product name when showProduct is false", () => {
    render(<Logo showProduct={false} />);
    expect(screen.getByText("hindbrain")).toBeInTheDocument();
    expect(screen.queryByText(/crosscheck/)).toBeNull();
  });
  it("shows product by default", () => {
    render(<Logo />);
    expect(screen.getByText(/crosscheck/)).toBeInTheDocument();
  });
});
