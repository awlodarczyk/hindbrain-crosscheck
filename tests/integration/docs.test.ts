import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const IGNORED_DIRS = new Set([
  "node_modules",
  "coverage",
  "test-results",
  "playwright-report",
  "node-compile-cache",
]);

describe.skipIf(!existsSync(join(root, "docs")))("repo docs", () => {
  const adrFiles = readdirSync(join(root, "docs/adr")).filter((f) => /^\d{4}-.*\.md$/.test(f));

  it("has a file for every ADR number referenced in ARCHITECTURE.md", () => {
    const refs = [...read("docs/ARCHITECTURE.md").matchAll(/ADR[- ]?(\d{1,4})/g)].map((m) =>
      m[1]!.padStart(4, "0"),
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const n of new Set(refs)) {
      expect(
        adrFiles.some((f) => f.startsWith(`${n}-`)),
        `ADR ${n}`,
      ).toBe(true);
    }
  });

  it("lists every ADR file in the adr index", () => {
    const index = read("docs/adr/README.md");
    for (const f of adrFiles) expect(index, f).toContain(f);
  });

  it("lists every top-level directory in the CONTEXT repo map", () => {
    const context = read("docs/CONTEXT.md");
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => !n.startsWith(".") && !n.startsWith("data") && !IGNORED_DIRS.has(n));
    for (const d of dirs) expect(context, d).toContain(`${d}/`);
  });

  it("ships an MIT license", () => {
    expect(existsSync(join(root, "LICENSE"))).toBe(true);
    expect(read("LICENSE")).toMatch(/^MIT License/);
  });
});
