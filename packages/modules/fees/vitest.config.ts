import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        name: "fees",
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["tests/integration/**", "**/node_modules/**", "**/dist/**"],
        passWithNoTests: true,
    },
});
