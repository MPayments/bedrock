import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.config.ts",
      "apps/workers/vitest.config.ts",
      "packages/platform/accounting/vitest.config.ts",
      "packages/platform/accounting/vitest.integration.config.ts",
      "packages/platform/balances/vitest.config.ts",
      "packages/platform/balances/vitest.integration.config.ts",
      "packages/modules/operational-accounts/vitest.config.ts",
      "packages/platform/db/vitest.config.ts",
      "packages/platform/dimensions/vitest.config.ts",
      "packages/sdk/countries/vitest.config.ts",
      "packages/modules/customers/vitest.config.ts",
      "packages/modules/customers/vitest.integration.config.ts",
      "packages/modules/currencies/vitest.config.ts",
      "packages/platform/documents/vitest.config.ts",
      "packages/platform/idempotency/vitest.config.ts",
      "packages/modules/fees/vitest.config.ts",
      "packages/modules/fees/vitest.integration.config.ts",
      "packages/modules/fx/vitest.config.ts",
      "packages/modules/fx/vitest.integration.config.ts",
      "packages/platform/ledger/vitest.config.ts",
      "packages/platform/ledger/vitest.integration.config.ts",
      "packages/modules/counterparties/vitest.config.ts",
      "packages/platform/reconciliation/vitest.config.ts",
      "packages/platform/reconciliation/vitest.integration.config.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
  },
});
