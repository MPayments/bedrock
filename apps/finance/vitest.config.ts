import path from "node:path";

import { defineProject } from "vitest/config";

export default defineProject({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@bedrock/sdk-api-client": path.resolve(
        __dirname,
        "../../packages/sdk/api-client/src/index.ts",
      ),
    },
  },
  test: {
    name: "finance",
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  },
});
