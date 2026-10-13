import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstRunPanel } from "./first-run-panel";
import { makeView } from "./view-fixture";

const found = { found: true, path: "~/.local/bin/claude", version: "2.1.0", checkedAt: "x" };

describe("FirstRunPanel", () => {
  it("offers the CLI as primary only when detected and allowed", async () => {
    const onUseCli = vi.fn().mockResolvedValue(undefined);
    render(
      <FirstRunPanel
        view={makeView({ cli: { claude: found, codex: found } })}
        onUseCli={onUseCli}
      />,
    );
    screen.getByRole("button", { name: "Use Claude Code CLI" }).click();
    expect(onUseCli).toHaveBeenCalledWith("claude");
  });

  it("falls back to API key links to settings", () => {
    render(
      <FirstRunPanel
        view={makeView({ cliAllowed: false, cli: { claude: found, codex: found } })}
        onUseCli={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Use Claude Code CLI" })).toBeNull();
    const links = screen.getAllByRole("link", { name: "Enter API key" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/settings/models");
    expect(screen.getAllByText("No CLI detected")).toHaveLength(2);
  });
});
