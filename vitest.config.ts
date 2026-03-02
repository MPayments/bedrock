import { defineConfig } from "vitest/config";
import { applicationIntegrationProjects } from "./packages/application/vitest.integration.config";
import { applicationUnitProjects } from "./packages/application/vitest.config";
import { coreIntegrationProjects } from "./packages/core/vitest.integration.config";
import { coreUnitProjects } from "./packages/core/vitest.config";

export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.config.ts",
      "apps/workers/vitest.config.ts",
      "packages/db/vitest.config.ts",
      "packages/kernel/vitest.config.ts",
      ...coreUnitProjects,
      ...coreIntegrationProjects,
      ...applicationUnitProjects,
      ...applicationIntegrationProjects,
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
  },
});
