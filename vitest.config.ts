import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.config.ts",
      "packages/accounting/vitest.config.ts",
      "packages/balances/vitest.config.ts",
      "packages/operational-accounts/vitest.config.ts",
      "packages/db/vitest.config.ts",
      "packages/dimensions/vitest.config.ts",
      "packages/countries/vitest.config.ts",
      "packages/customers/vitest.config.ts",
      "packages/customers/vitest.integration.config.ts",
      "packages/currencies/vitest.config.ts",
      "packages/documents/vitest.config.ts",
      "packages/idempotency/vitest.config.ts",
      "packages/fees/vitest.config.ts",
      "packages/fees/vitest.integration.config.ts",
      "packages/fx/vitest.config.ts",
      "packages/fx/vitest.integration.config.ts",
      "packages/ledger/vitest.config.ts",
      "packages/ledger/vitest.integration.config.ts",
      "packages/counterparties/vitest.config.ts",
      "packages/reconciliation/vitest.config.ts",
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
