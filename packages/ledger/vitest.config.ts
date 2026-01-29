import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      reporter: ["text", "html", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@repo/kernel": resolve(__dirname, "../kernel/src/index.ts"),
      "@repo/db": resolve(__dirname, "../db/src/index.ts"),
      "@repo/db/schema": resolve(__dirname, "../db/src/schema/index.ts"),
    },
  },
});
