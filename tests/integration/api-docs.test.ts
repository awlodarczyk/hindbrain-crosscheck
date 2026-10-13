import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? routeFiles(join(dir, e.name))
      : e.name === "route.ts"
        ? [join(dir, e.name)]
        : [],
  );
}

describe("docs/API.md", () => {
  const doc = readFileSync(join(process.cwd(), "docs", "API.md"), "utf8");
  const paths = routeFiles(ROOT).map(
    (f) => "/api/" + relative(ROOT, f).split(sep).slice(0, -1).join("/"),
  );

  it("finds the routes", () => {
    expect(paths.length).toBeGreaterThan(10);
  });

  it.each(paths)("documents %s", (path) => {
    expect(doc).toContain(`\`${path}\``);
  });
});
