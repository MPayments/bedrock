import { fileURLToPath } from "node:url";

import { defineProject } from "vitest/config";

export default defineProject({
  resolve: {
    alias: {
      "crm/schema": fileURLToPath(
        new URL("../crm/lib/server/tasks/schema.ts", import.meta.url),
      ),
    },
  },
  test: {
    name: "db",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: false,
  },
});
