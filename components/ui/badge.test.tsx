import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("colours the supported tone", () => {
    render(<Badge tone="supported">Supported</Badge>);
    expect(screen.getByText("Supported")).toHaveClass("text-status-supported");
  });

  it("shows a model dot for model tones", () => {
    render(<Badge tone="claude">Claude</Badge>);
    expect(screen.getByText("Claude").querySelector(".bg-model-claude")).not.toBeNull();
  });

  it("hides the dot when dot is false", () => {
    render(
      <Badge tone="chatgpt" dot={false}>
        GPT
      </Badge>,
    );
    expect(screen.getByText("GPT").querySelector(".bg-model-chatgpt")).toBeNull();
  });

  it("colours the partial tone with the unverifiable palette", () => {
    render(<Badge tone="partial">Partial</Badge>);
    expect(screen.getByText("Partial")).toHaveClass("text-status-unverifiable");
  });
});
