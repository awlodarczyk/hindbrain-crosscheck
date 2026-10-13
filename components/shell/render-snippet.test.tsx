import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderSnippet } from "./render-snippet";

const html = (s: string) => render(<p>{renderSnippet(s)}</p>).container;

describe("renderSnippet", () => {
  it("renders one mark element", () => {
    const c = html("a <mark>b</mark> c");
    expect(c.querySelectorAll("mark")).toHaveLength(1);
    expect(c.querySelector("mark")?.textContent).toBe("b");
    expect(c.textContent).toBe("a b c");
  });

  it("renders other tags as literal text", () => {
    const c = html("<script>alert(1)</script> <mark>x</mark>");
    expect(c.querySelector("script")).toBeNull();
    expect(c.textContent).toContain("<script>alert(1)</script>");
  });

  it("renders unbalanced tags as text", () => {
    const c = html("a <mark>b");
    expect(c.querySelector("mark")).toBeNull();
    expect(c.textContent).toBe("a <mark>b");
    expect(html("a </mark> b").textContent).toBe("a </mark> b");
  });
});
