import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("container build files", () => {
  const dockerfile = read("Dockerfile");

  it("runs as non-root with a healthcheck and a data volume", () => {
    expect(dockerfile).toContain("USER app");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain('VOLUME ["/data"]');
  });

  it("copies migrations from the build stage", () => {
    expect(dockerfile).toMatch(/COPY --from=build[^\n]*\/app\/drizzle/);
  });

  it("bakes no secrets", () => {
    expect(dockerfile).not.toMatch(/COPY[^\n]*\.env/);
    expect(dockerfile).not.toMatch(/^\s*ARG\s+\w*(KEY|SECRET)/im);
  });

  it(".dockerignore excludes env files, node_modules and data", () => {
    const lines = read(".dockerignore")
      .split("\n")
      .map((l) => l.trim());
    expect(lines).toEqual(expect.arrayContaining([".env*", "node_modules", "data*"]));
  });

  it("entrypoint fails fast without APP_SECRET", () => {
    const sh = read("scripts/docker-entrypoint.sh");
    expect(sh).toContain("APP_SECRET");
    expect(sh).toContain("exit 1");
    expect(sh).toContain("exec node server.js");
  });
});
