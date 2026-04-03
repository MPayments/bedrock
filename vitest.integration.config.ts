import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    maxWorkers: 1,
    projects: [
      "packages/modules/accounting/vitest.integration.config.ts",
      "packages/modules/agreements/vitest.integration.config.ts",
      "packages/modules/calculations/vitest.integration.config.ts",
      "packages/modules/deals/vitest.integration.config.ts",
      "packages/modules/documents/vitest.integration.config.ts",
      "packages/modules/ledger/vitest.integration.config.ts",
      "packages/modules/parties/vitest.integration.config.ts",
      "packages/modules/reconciliation/vitest.integration.config.ts",
      "packages/modules/treasury/vitest.integration.config.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
