import { describe, expect, it } from "vitest";
import { MAX_MARKDOWN_CHARS, renderMarkdown } from "./sanitize";

describe("renderMarkdown", () => {
  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("renders basic markdown", () => {
    expect(renderMarkdown("**hi** there")).toContain("<p><strong>hi</strong> there</p>");
  });

  it("removes script tags", () => {
    const html = renderMarkdown("ok\n\n<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("removes img with onerror", () => {
    const html = renderMarkdown('x <img src="x" onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
  });

  it("drops javascript: hrefs", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("adds rel and target to links", () => {
    const html = renderMarkdown("[site](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it("keeps markdown tables", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>2</td>");
  });

  it("downgrades h1 and h2 to h3", () => {
    const html = renderMarkdown("# Big\n\n## Mid\n\n#### Small");
    expect(html).not.toMatch(/<h[12]/);
    expect(html).toContain("<h3>Big</h3>");
    expect(html).toContain("<h3>Mid</h3>");
    expect(html).toContain("<h4>Small</h4>");
  });

  it("strips style and class attributes", () => {
    const html = renderMarkdown('<p class="x" style="color:red">hi</p>');
    expect(html).toBe("<p>hi</p>");
  });

  it("truncates oversized input", () => {
    const html = renderMarkdown("a".repeat(300_000));
    expect(html.length).toBeLessThan(MAX_MARKDOWN_CHARS + 50);
    expect(html).toContain("…");
  });
});
