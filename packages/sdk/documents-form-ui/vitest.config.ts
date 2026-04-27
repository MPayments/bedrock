import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "sdk-documents-form-ui",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: true,
  },
});
