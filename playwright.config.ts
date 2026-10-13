import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const HOSTED_PORT = 4174;
const baseURL = `http://127.0.0.1:${PORT}`;
const hostedURL = `http://127.0.0.1:${HOSTED_PORT}`;
const E2E_SECRET = "e2e-secret-at-least-32-characters-long";
const HOSTED_SPEC = /hosted-.*\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL },
  webServer: [
    {
      command: `node_modules/.bin/next dev -H 127.0.0.1 -p ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: { APP_SECRET: E2E_SECRET, PROVIDER_TRANSPORT: "mock", DATA_DIR: "./data-e2e" },
    },
    {
      command: `node_modules/.bin/next dev -H 127.0.0.1 -p ${HOSTED_PORT}`,
      url: `${hostedURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        APP_SECRET: E2E_SECRET,
        APP_MODE: "hosted",
        APP_URL: hostedURL,
        VALKEY_URL: "memory://local",
        TRUST_PROXY: "1",
        ADMIN_EMAIL: "admin@example.test",
        ADMIN_PASSWORD: "correct-horse-battery-staple",
        PROVIDER_TRANSPORT: "mock",
        DATA_DIR: "./data-e2e-hosted",
        NEXT_DIST_DIR: ".next-hosted",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/mobile\.spec\.ts/, HOSTED_SPEC],
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        viewport: { width: 390, height: 844 },
      },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: "hosted",
      use: { ...devices["Desktop Chrome"], baseURL: hostedURL },
      testMatch: HOSTED_SPEC,
    },
  ],
});
