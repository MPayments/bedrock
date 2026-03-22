import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/modules/accounting/vitest.integration.config.ts",
      "packages/modules/documents/vitest.integration.config.ts",
      "packages/modules/parties/vitest.integration.config.ts",
      "packages/modules/fees/vitest.integration.config.ts",
      "packages/modules/fx/vitest.integration.config.ts",
      "packages/modules/ledger/vitest.integration.config.ts",
      "packages/modules/reconciliation/vitest.integration.config.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
