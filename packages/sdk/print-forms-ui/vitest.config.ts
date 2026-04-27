import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "sdk-print-forms-ui",
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: true,
  },
});
