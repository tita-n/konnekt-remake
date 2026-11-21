import { defineConfig, devices } from "@playwright/test";
import { guardFromEnvironment, loadEnvFile } from "./scripts/e2e-guard";

loadEnvFile(".env");
loadEnvFile(".env.e2e.local");

const e2eUrl = guardFromEnvironment();
// Test workers (including the isolation proof) must see the e2e database too.
process.env.DATABASE_URL = e2eUrl;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }], ["json", { outputFile: "test-results/e2e.json" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false },
    },
  ],
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      E2E: "1",
      E2E_DATABASE_URL: e2eUrl,
      DATABASE_URL: e2eUrl,
    },
  },
});
