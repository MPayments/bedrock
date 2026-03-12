import { defineConfig, defineProject } from "vitest/config";

const NODE_EXCLUDE = ["**/node_modules/**", "**/dist/**"];
const PROJECT_ROOT = new URL(".", import.meta.url).pathname;
const INTEGRATION_PREFLIGHT_SETUP_FILE = "./tests/integration/preflight.setup.ts";

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
      setupFiles: setupFile
        ? [INTEGRATION_PREFLIGHT_SETUP_FILE, setupFile]
        : [INTEGRATION_PREFLIGHT_SETUP_FILE],
      pool: "forks",
      fileParallelism: false,
    },
  });
}

export const appIntegrationProjects = [
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
  integrationProject("fees:integration", "fees", "./tests/fees/integration/setup.ts"),
  integrationProject("fx:integration", "fx", "./tests/fx/integration/setup.ts"),
];

export default defineConfig({
  test: {
    projects: appIntegrationProjects,
  },
});
