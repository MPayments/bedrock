import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "workflow-deal-commercial",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: false,
  },
});
