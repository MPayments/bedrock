import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "transfers:integration",
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    fileParallelism: false,
  },
});
