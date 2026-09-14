import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"], ignoreHTTPSErrors: true,
    trace: "off", screenshot: "off", video: "off",
  },
  projects: [
    { name: "public", use: { baseURL: "https://localhost:3440" } },
    { name: "app", use: { baseURL: "https://localhost:3441" } },
    { name: "backoffice", use: { baseURL: "https://localhost:3442" } },
  ],
  webServer: {
    command: "node tests/e2e/server.mjs", url: "https://localhost:3442/api/health",
    ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 60_000,
  },
});
