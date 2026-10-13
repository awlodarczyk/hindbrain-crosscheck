import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnswerCard } from "./answer-card";
import { makeCall } from "./fixtures";
import { ReviewCard } from "./review-card";

describe("live card states", () => {
  it("running answer shows label, search count, header meta and sources hint", () => {
    render(
      <AnswerCard
        provider="claude"
        call={makeCall({ status: "running", searches: 2, html: null })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Claude is answering… · 2 searches");
    expect(screen.getByText("running · 2 searches")).toBeInTheDocument();
    expect(screen.getByText("Sources appear when the answer lands")).toBeInTheDocument();
  });

  it("pending review shows the idle line", () => {
    render(<ReviewCard reviewer="chatgpt" target="claude" call={null} claims={[]} />);
    expect(screen.getByText("Starts when Claude's answer lands")).toBeInTheDocument();
  });

  it("running review shows the checking label", () => {
    render(
      <ReviewCard
        reviewer="chatgpt"
        target="claude"
        call={makeCall({ kind: "review", provider: "chatgpt", status: "running", searches: 1 })}
        claims={[]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("ChatGPT is checking sources… · 1 search");
  });

  it("failed answer renders the error state", () => {
    render(
      <AnswerCard
        provider="chatgpt"
        call={makeCall({ status: "failed", errorCode: "x", errorMessage: "boom", html: null })}
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
