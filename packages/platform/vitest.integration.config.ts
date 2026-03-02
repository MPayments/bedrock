import { defineConfig, defineProject } from "vitest/config";

const NODE_EXCLUDE = ["**/node_modules/**", "**/dist/**"];
const PROJECT_ROOT = new URL(".", import.meta.url).pathname;

function integrationProject(name, domain, setupFile) {
  return defineProject({
    root: PROJECT_ROOT,
    test: {
      name,
      globals: true,
      environment: "node",
      include: [`tests/${domain}/integration/**/*.test.ts`],
      exclude: NODE_EXCLUDE,
      testTimeout: 30000,
      hookTimeout: 30000,
      setupFiles: setupFile ? [setupFile] : [],
      pool: "forks",
      fileParallelism: false,
    },
  });
}

export const platformIntegrationProjects = [
  integrationProject("accounting:integration", "accounting"),
  integrationProject("balances:integration", "balances"),
  integrationProject(
    "customers:integration",
    "customers",
    "./tests/customers/integration/setup.ts",
  ),
  integrationProject(
    "ledger:integration",
    "ledger",
    "./tests/ledger/integration/setup.ts",
  ),
  integrationProject("reconciliation:integration", "reconciliation"),
];

export default defineConfig({
  test: {
    projects: platformIntegrationProjects,
  },
});
