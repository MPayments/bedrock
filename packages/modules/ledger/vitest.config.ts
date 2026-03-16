import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "ledger",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/integration/**",
      "tests/infra/tigerbeetle/integration/**",
      "**/node_modules/**",
      "**/dist/**",
    ],
    passWithNoTests: false,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
