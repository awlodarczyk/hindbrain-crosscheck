import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOKENS } from "@/lib/theme/tokens";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return "";
  return css.slice(start, css.indexOf("\n}", start));
}

describe("globals.css", () => {
  it("declares every light value in :root", () => {
    const root = block(":root");
    for (const t of TOKENS) expect(root).toContain(`${t.css}: ${t.light};`);
  });
  it("declares every dark value in .dark", () => {
    const dark = block(".dark");
    for (const t of TOKENS) expect(dark).toContain(`${t.css}: ${t.dark};`);
  });
  it("maps every token in @theme inline", () => {
    const theme = block("@theme inline");
    for (const t of TOKENS) {
      expect(theme).toContain(`--color-${t.name.replace("/", "-")}: var(${t.css});`);
    }
  });
  it("has a reduce-motion rule", () => expect(css).toContain(".reduce-motion"));
});
