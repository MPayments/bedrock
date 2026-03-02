import { defineConfig, defineProject } from "vitest/config";

const NODE_EXCLUDE = ["**/node_modules/**", "**/dist/**"];
const PROJECT_ROOT = new URL(".", import.meta.url).pathname;

function moduleProject(config) {
  return defineProject({
    root: PROJECT_ROOT,
    ...config,
  });
}

export const moduleUnitProjects = [
  moduleProject({
    test: {
      name: "accounting-reporting",
      globals: true,
      environment: "node",
      include: ["tests/accounting-reporting/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
      passWithNoTests: true,
    },
  }),
  moduleProject({
    test: {
      name: "fees",
      globals: true,
      environment: "node",
      include: ["tests/fees/**/*.test.ts"],
      exclude: ["tests/fees/integration/**", ...NODE_EXCLUDE],
    },
  }),
  moduleProject({
    test: {
      name: "fx",
      globals: true,
      environment: "node",
      include: ["tests/fx/**/*.test.ts"],
      exclude: ["tests/fx/integration/**", ...NODE_EXCLUDE],
    },
  }),
  moduleProject({
    test: {
      name: "payments",
      globals: true,
      environment: "node",
      include: ["tests/payments/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
];

export default defineConfig({
  test: {
    projects: moduleUnitProjects,
  },
});
