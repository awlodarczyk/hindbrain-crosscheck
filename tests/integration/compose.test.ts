import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { EnvSchema } from "@/lib/env";

const read = (p: string) => readFileSync(p, "utf8");
const raw = read("deploy/docker-compose.dokploy.yml");
const compose = parse(raw) as {
  services: Record<
    "app" | "valkey",
    {
      healthcheck?: unknown;
      volumes?: string[];
      ports?: unknown;
      environment?: Record<string, string>;
      depends_on: Record<string, { condition: string }>;
    }
  >;
  volumes: Record<string, unknown>;
};

describe("dokploy compose", () => {
  it("defines app and valkey, both with healthchecks", () => {
    expect(Object.keys(compose.services).sort()).toEqual(["app", "valkey"]);
    expect(compose.services.app.healthcheck).toBeDefined();
    expect(compose.services.valkey.healthcheck).toBeDefined();
  });

  it("persists /data and waits for a healthy valkey", () => {
    expect(compose.services.app.volumes).toContain("crosscheck-data:/data");
    expect(compose.volumes).toHaveProperty("crosscheck-data");
    expect(compose.services.app.depends_on.valkey?.condition).toBe("service_healthy");
  });

  it("publishes no host ports", () => {
    expect(compose.services.valkey.ports).toBeUndefined();
    expect(compose.services.app.ports).toBeUndefined();
  });

  it("runs hosted behind one trusted proxy hop with the CLI off", () => {
    const e = compose.services.app.environment;
    expect(e).toMatchObject({ APP_MODE: "hosted", TRUST_PROXY: "1", CLI_ENABLED: "0" });
  });

  it("requires a valkey password and holds no literal secrets", () => {
    expect(raw).toMatch(/--requirepass\n\s*- \$\{VALKEY_PASSWORD:\?/);
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(raw).not.toMatch(/password:\s*[^$\s"'][^\s]{7,}/i);
  });
});

describe("env examples", () => {
  const keys = Object.keys(EnvSchema.innerType().shape);

  it.each(["production", "staging"])("%s example lists every EnvSchema key", (name) => {
    const text = read(`deploy/env.${name}.example`);
    for (const k of keys) expect(text, k).toMatch(new RegExp(`^#?\\s*${k}=`, "m"));
  });

  it("only sets TRUST_PROXY=1 and hosted mode", () => {
    expect(read("deploy/env.production.example")).toMatch(/^TRUST_PROXY=1$/m);
    expect(read("deploy/env.production.example")).toMatch(/^APP_MODE=hosted$/m);
  });
});

describe("node floor", () => {
  it("is 22 everywhere", () => {
    expect(JSON.parse(read("package.json")).engines.node).toBe(">=22");
    expect(read(".nvmrc").trim()).toBe("22");
    expect(read(".github/workflows/ci.yml")).toMatch(/node-version: 22/);
  });
});
