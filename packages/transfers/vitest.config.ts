import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        name: "transfers",
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["tests/integration/**/*.test.ts", "**/node_modules/**", "**/dist/**"],
    },
});
