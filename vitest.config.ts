import { defineConfig } from "vitest/config";
import { appIntegrationProjects } from "./packages/application/vitest.integration.config";
import { appUnitProjects } from "./packages/application/vitest.config";

export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.config.ts",
      "apps/workers/vitest.config.ts",
      "packages/db/vitest.config.ts",
      "packages/common/vitest.config.ts",
      ...appUnitProjects,
      ...appIntegrationProjects,
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
  },
});
