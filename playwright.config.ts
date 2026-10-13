import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const HOSTED_PORT = 4174;
const baseURL = `http://127.0.0.1:${PORT}`;
const LIVE_PORT = 4273;
const liveURL = `http://127.0.0.1:${LIVE_PORT}`;
const hostedURL = `http://127.0.0.1:${HOSTED_PORT}`;
const E2E_SECRET = "e2e-secret-at-least-32-characters-long";
const HOSTED_SPEC = /hosted-.*\.spec\.ts/;
const LIVE_SPEC = /live\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL, extraHTTPHeaders: { origin: baseURL } },
  webServer: [
    {
      command: `node_modules/.bin/next dev -H 127.0.0.1 -p ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: { APP_SECRET: E2E_SECRET, PROVIDER_TRANSPORT: "mock", DATA_DIR: "./data-e2e" },
    },
    {
      command: `node_modules/.bin/next dev -H 127.0.0.1 -p ${LIVE_PORT}`,
      url: liveURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        APP_SECRET: E2E_SECRET,
        PROVIDER_TRANSPORT: "mock",
        DATA_DIR: "./data-e2e-live",
        NEXT_DIST_DIR: ".next-live",
        MOCK_DELAY_MS: "1500",
        MOCK_FAIL: "chatgpt",
      },
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
        CLI_ENABLED: "0",
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
      testIgnore: [/mobile\.spec\.ts/, HOSTED_SPEC, LIVE_SPEC],
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
      name: "live",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: liveURL,
        extraHTTPHeaders: { origin: liveURL },
      },
      testMatch: LIVE_SPEC,
    },
    {
      name: "hosted",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: hostedURL,
        extraHTTPHeaders: { origin: hostedURL, "x-forwarded-for": "203.0.113.10" },
      },
      testMatch: HOSTED_SPEC,
    },
  ],
});
