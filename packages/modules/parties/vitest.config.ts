import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "parties",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "tests/integration/**/*.test.ts",
    ],
    passWithNoTests: true,
  },
});
