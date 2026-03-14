import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "money",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
