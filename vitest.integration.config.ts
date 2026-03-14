import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/modules/accounting/vitest.integration.config.ts",
      "packages/modules/balances/vitest.integration.config.ts",
      "packages/modules/customers/vitest.integration.config.ts",
      "packages/modules/fees/vitest.integration.config.ts",
      "packages/modules/fx/vitest.integration.config.ts",
      "packages/modules/ledger/vitest.integration.config.ts",
      "packages/modules/requisites/vitest.integration.config.ts",
      "packages/modules/reconciliation/vitest.integration.config.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
