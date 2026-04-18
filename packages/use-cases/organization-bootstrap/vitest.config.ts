import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "use-case-organization-bootstrap",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: false,
  },
});
