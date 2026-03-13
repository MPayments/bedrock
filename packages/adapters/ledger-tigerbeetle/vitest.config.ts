import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "adapter-ledger-tigerbeetle",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**", "**/node_modules/**", "**/dist/**"],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
