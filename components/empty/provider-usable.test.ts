import { describe, expect, it } from "vitest";
import { isProviderUsable } from "./provider-usable";
import { makeView } from "./view-fixture";

const found = { found: true, checkedAt: "x" };
const key = {
  source: "env",
  effective: "env",
  masked: "sk-…",
  valid: true,
  updatedAt: null,
} as const;

describe("isProviderUsable", () => {
  it.each([
    ["nothing", makeView(), "claude", false],
    ["key", makeView({ secrets: { claude: key, chatgpt: key } }), "chatgpt", true],
    ["cli allowed", makeView({ cli: { claude: found, codex: found } }), "claude", true],
    ["cli codex", makeView({ cli: { claude: found, codex: found } }), "chatgpt", true],
    [
      "cli disallowed",
      makeView({ cliAllowed: false, cli: { claude: found, codex: found } }),
      "claude",
      false,
    ],
    ["mock", makeView({ transportMode: "mock" }), "claude", true],
  ] as const)("%s", (_n, view, p, want) => {
    expect(isProviderUsable(view, p)).toBe(want);
  });
});
