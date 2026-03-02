import { defineConfig } from "vitest/config";
import { moduleIntegrationProjects } from "./packages/modules/vitest.integration.config";
import { moduleUnitProjects } from "./packages/modules/vitest.config";
import { platformIntegrationProjects } from "./packages/platform/vitest.integration.config";
import { platformUnitProjects } from "./packages/platform/vitest.config";

export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.config.ts",
      "apps/workers/vitest.config.ts",
      "packages/db/vitest.config.ts",
      "packages/foundation/vitest.config.ts",
      ...platformUnitProjects,
      ...platformIntegrationProjects,
      ...moduleUnitProjects,
      ...moduleIntegrationProjects,
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
  },
});
