import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./error-state";
import { makeCall } from "./fixtures";

describe("ErrorState", () => {
  it("shows message and code and retries", () => {
    const onRetry = vi.fn();
    const call = makeCall({
      id: "c9",
      status: "failed",
      errorCode: "provider_http",
      errorMessage: "Bad gateway",
    });
    render(<ErrorState call={call} onRetry={onRetry} />);
    expect(screen.getByText("Bad gateway")).toBeInTheDocument();
    expect(screen.getByText("provider_http")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith("c9");
  });

  it("uses the restart message for interrupted calls", () => {
    const call = makeCall({ status: "failed", errorCode: "interrupted", errorMessage: "x" });
    render(<ErrorState call={call} />);
    expect(screen.getByText("The app restarted while this call was running.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["answer_failed", "Skipped — the answer failed."],
    ["aborted", "Skipped — the run was cancelled."],
  ])("renders skipped %s", (code, text) => {
    render(<ErrorState call={makeCall({ status: "skipped", errorCode: code })} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ErrorState fallbacks", () => {
  it("uses a default message and omits the code", () => {
    render(
      <ErrorState call={makeCall({ status: "failed", errorCode: null, errorMessage: null })} />,
    );
    expect(screen.getByText("This call failed.")).toBeInTheDocument();
    expect(document.querySelector("code")).toBeNull();
  });

  it("falls back for unknown skip reasons", () => {
    render(<ErrorState call={makeCall({ status: "skipped", errorCode: null })} />);
    expect(screen.getByText("Skipped.")).toBeInTheDocument();
  });
});
