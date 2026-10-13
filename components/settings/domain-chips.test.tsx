import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DomainChips } from "./domain-chips";

const setup = (domains: readonly string[] = []) => {
  const onChange = vi.fn();
  render(<DomainChips domains={domains} onChange={onChange} />);
  return onChange;
};
const type = async (text: string) => {
  await userEvent.click(screen.getByRole("button", { name: /add domain/i }));
  await userEvent.type(screen.getByLabelText("Domain"), text);
};

describe("DomainChips", () => {
  it("adds a valid domain on Enter", async () => {
    const onChange = setup(["who.int"]);
    await type("NIH.gov{Enter}");
    expect(onChange).toHaveBeenCalledWith(["who.int", "nih.gov"]);
  });

  it("rejects an invalid domain with an inline error", async () => {
    const onChange = setup();
    await type("not a domain{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a domain like nih.gov");
  });

  it("ignores duplicates", async () => {
    const onChange = setup(["nih.gov"]);
    await type("nih.gov{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a chip", async () => {
    const onChange = setup(["a.com", "b.com"]);
    await userEvent.click(screen.getByRole("button", { name: "Remove a.com" }));
    expect(onChange).toHaveBeenCalledWith(["b.com"]);
  });

  it("disables add at 20 domains", () => {
    setup(Array.from({ length: 20 }, (_, i) => `d${i}.com`));
    expect(screen.getByRole("button", { name: /add domain/i })).toBeDisabled();
  });

  it("cancels entry with Escape", async () => {
    setup();
    await type("{Escape}");
    expect(screen.queryByLabelText("Domain")).toBeNull();
  });
});
