import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "api",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
