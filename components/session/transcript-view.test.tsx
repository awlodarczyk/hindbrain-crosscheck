import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeDetail } from "./fixtures";
import { SessionHeader } from "./header";
import { TranscriptView } from "./transcript-view";

describe("TranscriptView", () => {
  it("renders one labelled block per turn", () => {
    render(<TranscriptView text={"User: Is it safe?\nAssistant: Mostly."} />);
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual(["User", "Assistant"]);
    expect(screen.getAllByRole("definition").map((d) => d.textContent)).toEqual([
      "Is it safe?",
      "Mostly.",
    ]);
  });
  it("renders unmarked text without labels", () => {
    render(<TranscriptView text="just some notes" />);
    expect(screen.queryAllByRole("term")).toHaveLength(0);
    expect(screen.getByText("just some notes")).toBeInTheDocument();
  });
  it("renders markup literally", () => {
    const { container } = render(<TranscriptView text="User: <script>alert(1)</script>" />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });
});

describe("SessionHeader transcript badge", () => {
  const base = makeDetail().session;
  it("shows a Transcript badge in transcript mode", () => {
    const session = { ...base, mode: "transcript" as const, transcript: "User: hi" };
    render(<SessionHeader session={session} meta="meta" />);
    expect(screen.getByText("Transcript")).toBeInTheDocument();
  });
  it("omits the badge otherwise", () => {
    render(<SessionHeader session={base} meta="meta" />);
    expect(screen.queryByText("Transcript")).toBeNull();
  });
});
