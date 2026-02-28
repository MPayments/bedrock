import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "ledger",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    exclude: ["tests/integration/**", "**/node_modules/**", "**/dist/**"],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true
  }
});
