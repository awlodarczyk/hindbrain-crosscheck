import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SecretView } from "@/lib/api/settings-dto";
import type { CliInfo } from "@/lib/providers/cli-detect";
import { ProviderCard, type ProviderCardProps } from "./provider-card";

const none: SecretView = {
  source: "none",
  effective: "none",
  masked: null,
  valid: null,
  updatedAt: null,
};
const db: SecretView = { ...none, source: "db", effective: "db", masked: "sk-••••1234" };
const found: CliInfo = {
  found: true,
  path: "/usr/bin/claude",
  version: "2.1.0",
  account: "adam@x.dev",
  checkedAt: "2026-01-01T00:00:00Z",
};
const missing: CliInfo = { found: false, checkedAt: "2026-01-01T00:00:00Z" };

const setup = (over: Partial<ProviderCardProps> = {}) => {
  const props: ProviderCardProps = {
    provider: "claude",
    connection: "api",
    cliAllowed: true,
    cli: missing,
    secret: none,
    onConnection: vi.fn(),
    onTest: vi.fn(),
    onReplace: vi.fn().mockResolvedValue(undefined),
    onReveal: vi.fn().mockResolvedValue("k"),
    onRemove: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(<ProviderCard {...props} />);
  return props;
};

describe("ProviderCard", () => {
  it("disables the CLI option with a tooltip when hosted", async () => {
    setup({ cliAllowed: false });
    expect(screen.getByRole("radio", { name: /claude code cli/i })).toBeDisabled();
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "CLI is not available in hosted mode",
    );
  });

  it("renders API rows with a notice for a stored cli connection in hosted mode", () => {
    setup({ cliAllowed: false, connection: "cli" });
    expect(
      screen.getByText(/CLI connections are not available in hosted mode/),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Anthropic credentials" })).toBeInTheDocument();
  });

  it.each([
    ["api key present", { secret: db }, "Connected"],
    ["no key", { secret: none }, "Not connected"],
    ["cli found", { connection: "cli" as const, cli: found }, "Connected"],
    ["cli missing", { connection: "cli" as const, cli: missing }, "Not connected"],
  ])("badge: %s", (_n, over, text) => {
    setup(over);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("switches connection", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("radio", { name: /claude code cli/i }));
    expect(p.onConnection).toHaveBeenCalledWith("cli");
  });

  it("shows detection details and calls onTest", async () => {
    const p = setup({ connection: "cli", cli: found });
    expect(screen.getByText("claude 2.1.0 · adam@x.dev")).toBeInTheDocument();
    expect(screen.getByLabelText("CLI path")).toHaveValue("/usr/bin/claude");
    await userEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(p.onTest).toHaveBeenCalled();
  });

  it("reports a missing CLI", () => {
    setup({ connection: "cli", cli: missing });
    expect(screen.getByLabelText("CLI path")).toHaveValue("not found in PATH");
    expect(screen.getByText("not detected")).toBeInTheDocument();
  });

  it("shows the Codex hint only for chatgpt over cli", () => {
    setup({ provider: "chatgpt", connection: "cli" });
    expect(screen.getByText("Codex uses the answer model for verification")).toBeInTheDocument();
  });

  it("omits the Codex hint for claude and api mode", () => {
    setup({ provider: "claude", connection: "cli" });
    expect(screen.queryByText(/Codex uses/)).toBeNull();
  });

  it("shows the key field for api connections", () => {
    setup({ secret: db });
    expect(screen.getByText("sk-••••1234")).toBeInTheDocument();
    expect(screen.getByText("ANTHROPIC_API_KEY in .env")).toBeInTheDocument();
  });
});
