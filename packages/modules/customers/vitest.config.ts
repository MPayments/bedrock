import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "customers",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/customers/integration/**", "**/node_modules/**", "**/dist/**"],
    passWithNoTests: false,
  },
});
