import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EnvSchema } from "@/lib/env";

const readme = readFileSync("README.md", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const HEADINGS = [
  "How it works",
  "Run locally",
  "Configuration",
  "Testing",
  "Deploy on Dokploy",
  "Security model",
  "Data & privacy",
  "Contributing",
  "License",
];

describe("README", () => {
  it.each(HEADINGS)("has a '## %s' section", (h) => {
    expect(readme).toMatch(new RegExp(`^## ${h}$`, "m"));
  });

  it("mentions every environment key", () => {
    // EnvSchema is a ZodEffects; the object shape sits on the inner schema.
    const schema = EnvSchema as unknown as { _def: { schema?: { shape: object } }; shape?: object };
    const shape = schema.shape ?? schema._def.schema?.shape ?? {};
    const keys = Object.keys(shape);
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) expect(readme, key).toContain(key);
  });

  it("only references existing pnpm scripts", () => {
    const builtins = new Set(["install", "exec", "dlx"]);
    const used = [...readme.matchAll(/pnpm ([a-z0-9:-]+)/g)].map((m) => m[1] as string);
    for (const name of used) {
      expect(builtins.has(name) || name in pkg.scripts, `pnpm ${name}`).toBe(true);
    }
  });

  it("contains no API-key-looking strings", () => {
    expect(readme).not.toMatch(/sk-[A-Za-z0-9]{12,}/);
  });
});
