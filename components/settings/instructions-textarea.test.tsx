import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { INSTRUCTIONS_TEMPLATE } from "@/lib/pipeline/templates";
import { InstructionsTextarea } from "./instructions-textarea";

describe("InstructionsTextarea", () => {
  it("formats the counter", () => {
    render(<InstructionsTextarea value={"x".repeat(142)} onChange={vi.fn()} />);
    expect(screen.getByText("142 / 1,000 characters")).toBeInTheDocument();
  });

  it("inserts the template", async () => {
    const onChange = vi.fn();
    render(<InstructionsTextarea value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Insert template" }));
    expect(onChange).toHaveBeenCalledWith(INSTRUCTIONS_TEMPLATE);
  });

  it("caps input at 1000 characters", () => {
    render(<InstructionsTextarea value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Custom instructions")).toHaveAttribute("maxlength", "1000");
  });

  it("reports typed text", async () => {
    const onChange = vi.fn();
    render(<InstructionsTextarea value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Custom instructions"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
