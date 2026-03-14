import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "platform-postgres",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**", "**/node_modules/**", "**/dist/**"],
    passWithNoTests: false,
  },
});
