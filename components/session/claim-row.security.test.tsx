import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Claim } from "@/lib/repos/types";
import { ClaimRow } from "./claim-row";

const claim = (over: Partial<Claim>): Claim =>
  ({
    id: "c1",
    callId: "k1",
    idx: 0,
    claim: "A claim",
    verdict: "disputed",
    note: null,
    sourceUrl: null,
    sourceTitle: null,
    ...over,
  }) satisfies Claim;

describe("ClaimRow with hostile model output", () => {
  it("renders a markup note as text", () => {
    const { container } = render(<ClaimRow claim={claim({ note: "<svg onload=alert(1)>" })} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toContain("<svg onload=alert(1)>");
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "vbscript:x"])(
    "does not link %s",
    (sourceUrl) => {
      const { container } = render(<ClaimRow claim={claim({ sourceUrl })} />);
      expect(container.querySelector("a")).toBeNull();
    },
  );

  it("links an https source", () => {
    const { container } = render(<ClaimRow claim={claim({ sourceUrl: "https://ok.example/x" })} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://ok.example/x");
  });
});
