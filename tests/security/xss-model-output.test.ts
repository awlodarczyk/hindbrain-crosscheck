import { describe, expect, it } from "vitest";
import { MAX_MARKDOWN_CHARS, renderMarkdown } from "@/lib/security/sanitize";

describe("renderMarkdown against hostile model output", () => {
  it.each([
    ["<img src=x onerror=alert(1)>", /<img|onerror/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript:/i],
    ["<script>alert(1)</script>", /<script|alert\(1\)/i],
    ["<svg onload=alert(1)>", /<svg|onload/i],
    ["[x](javascript:alert(1))", /javascript:/i],
    ["<iframe src=//evil.example></iframe>", /<iframe/i],
    ["<style>body{display:none}</style>", /<style|display/i],
    ['<p style="x" class="y" onclick="z">t</p>', /style=|class=|onclick/i],
    ["[x](data:text/html;base64,AAAA)", /data:/i],
    ["[x](//evil.example)", /href="\/\//],
  ])("strips %s", (input, forbidden) => {
    expect(renderMarkdown(input)).not.toMatch(forbidden);
  });

  it("keeps tables, fenced code and strikethrough", () => {
    const html = renderMarkdown(
      "| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncode\n```\n\n<del>x</del> ~~y~~",
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<pre><code>");
    expect(html.match(/<del>/g)).toHaveLength(2);
  });

  it("forces safe link attributes", () => {
    const html = renderMarkdown('<a href="https://ok.example" target="_self" rel="opener">x</a>');
    expect(html).toContain('rel="noopener nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it("maps h1 and h2 to h3 and drops h5", () => {
    const html = renderMarkdown("# a\n\n## b\n\n##### c");
    expect(html).not.toMatch(/<h[1256]/);
    expect(html.match(/<h3>/g)).toHaveLength(2);
  });

  it("caps input on a code point boundary", () => {
    const html = renderMarkdown("😀".repeat(MAX_MARKDOWN_CHARS));
    expect(html).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    expect(html.length).toBeLessThan(MAX_MARKDOWN_CHARS + 20);
  });
});
