import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ["./tests/integration/setup.ts"],
    pool: "forks",
    // Vitest 4: poolOptions moved to top-level
    singleFork: true,
    // Force sequential execution to avoid database conflicts
    fileParallelism: false
  }
});
