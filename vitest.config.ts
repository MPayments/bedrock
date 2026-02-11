import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/ledger/vitest.config.ts",
      "packages/ledger/vitest.integration.config.ts",
      "packages/treasury/vitest.config.ts",
      "packages/treasury/vitest.integration.config.ts",
      "packages/transfers/vitest.config.ts"
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
});
