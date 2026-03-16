import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "plugin-documents-ifrs",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: true,
  },
});
