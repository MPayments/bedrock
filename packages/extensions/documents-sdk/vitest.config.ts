import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "extension-documents-sdk",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: true,

  },
});
