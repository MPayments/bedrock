import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/db/vitest.config.ts",
      "packages/countries/vitest.config.ts",
      "packages/customers/vitest.config.ts",
      "packages/customers/vitest.integration.config.ts",
      "packages/currencies/vitest.config.ts",
      "packages/fees/vitest.config.ts",
      "packages/fees/vitest.integration.config.ts",
      "packages/fx/vitest.config.ts",
      "packages/fx/vitest.integration.config.ts",
      "packages/ledger/vitest.config.ts",
      "packages/ledger/vitest.integration.config.ts",
      "packages/treasury/vitest.config.ts",
      "packages/treasury/vitest.integration.config.ts",
      "packages/transfers/vitest.config.ts",
      "packages/counterparties/vitest.config.ts",
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
        statements: 80,
      },
    },
  },
});
