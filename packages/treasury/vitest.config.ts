import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        name: "treasury",
        globals: false,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["tests/integration/**", "**/node_modules/**", "**/dist/**"],
        testTimeout: 10000,
    },
});
