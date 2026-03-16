import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "accounting:integration",
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: [new URL("../../../tests/integration/preflight.setup.ts", import.meta.url).pathname],
    pool: "forks",
    fileParallelism: false,
  },
});
