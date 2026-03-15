import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "guardrails",
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
