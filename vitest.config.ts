import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL(".", import.meta.url)),
  "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["lib/**", "components/**", "app/api/**"],
      exclude: ["**/*.test.*"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["tests/e2e/**", "node_modules/**", ".next/**", "components/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["components/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
