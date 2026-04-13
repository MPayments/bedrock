import { defineConfig, devices } from "@playwright/test";

const authFile = "playwright/.auth/operator.json";
const isHeadless = process.env.PLAYWRIGHT_HEADLESS === "1";

export default defineConfig({
  outputDir: "artifacts/playwright-test/results",
  reporter: [
    [
      "html",
      { open: "never", outputFolder: "artifacts/playwright-test/report" },
    ],
  ],
  retries: 1,
  testDir: "./tests/e2e",
  timeout: 180_000,
  use: {
    baseURL: process.env.CRM_BASE_URL ?? "http://localhost:3002",
    headless: isHeadless,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        storageState: undefined,
      },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
  ],
});
