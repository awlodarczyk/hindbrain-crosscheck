import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = fileURLToPath(new URL("../../.github/workflows/ci.yml", import.meta.url));

interface Step {
  uses?: string;
  run?: string;
}

interface Workflow {
  on?: unknown;
  jobs?: Record<string, { steps?: Step[] }>;
}

function loadWorkflow(): Workflow {
  return parse(readFileSync(WORKFLOW_PATH, "utf8")) as Workflow;
}

function ciSteps(workflow: Workflow): Step[] {
  return workflow.jobs?.ci?.steps ?? [];
}

function indexOfStep(steps: string[], needle: string): number {
  return steps.findIndex((step) => step.includes(needle));
}

describe("ci workflow", () => {
  it("triggers on push and pull_request", () => {
    const { on } = loadWorkflow();
    const triggers = typeof on === "object" && on !== null ? Object.keys(on) : [];
    expect(triggers).toEqual(expect.arrayContaining(["push", "pull_request"]));
  });

  it("runs gitleaks, format, lint, typecheck, test, then e2e in order", () => {
    const steps = ciSteps(loadWorkflow());
    const uses = steps.map((step) => step.uses ?? "");
    const runs = steps.map((step) => step.run ?? "");

    const gitleaksAt = uses.findIndex((value) => value.includes("gitleaks"));
    const order = ["pnpm format:check", "pnpm lint", "pnpm typecheck", "pnpm test", "pnpm e2e"].map(
      (needle) => indexOfStep(runs, needle),
    );

    expect(gitleaksAt).toBeGreaterThanOrEqual(0);
    for (const index of order) {
      expect(index).toBeGreaterThan(-1);
    }
    const positions = [gitleaksAt, ...order];
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1] ?? -1);
    }
  });
});
