import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FewShotDialog } from "./fewshot-dialog";

const setup = (examples: readonly { question: string; answer: string }[] = []) => {
  const onSave = vi.fn();
  const onOpenChange = vi.fn();
  render(<FewShotDialog open onOpenChange={onOpenChange} examples={examples} onSave={onSave} />);
  return { onSave, onOpenChange };
};

describe("FewShotDialog", () => {
  it("adds examples up to five", async () => {
    setup();
    const add = screen.getByRole("button", { name: "Add example" });
    for (let i = 0; i < 5; i++) await userEvent.click(add);
    expect(screen.getAllByLabelText(/^Question \d$/)).toHaveLength(5);
    expect(add).toBeDisabled();
  });

  it("removes an example", async () => {
    setup([
      { question: "q1", answer: "a1" },
      { question: "q2", answer: "a2" },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Remove example 1" }));
    expect(screen.getAllByLabelText(/^Question \d$/)).toHaveLength(1);
    expect(screen.getByLabelText("Question 1")).toHaveValue("q2");
  });

  it("saves a new list without mutating the input", async () => {
    const input = [{ question: "q1", answer: "a1" }];
    const { onSave, onOpenChange } = setup(input);
    await userEvent.type(screen.getByLabelText("Answer 1"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Add example" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith([{ question: "q1", answer: "a1!" }]);
    expect(input).toEqual([{ question: "q1", answer: "a1" }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("discards on Cancel", async () => {
    const { onSave, onOpenChange } = setup([{ question: "q", answer: "a" }]);
    await userEvent.type(screen.getByLabelText("Question 1"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
