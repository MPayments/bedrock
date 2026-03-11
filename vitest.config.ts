import { defineConfig, defineProject } from "vitest/config";

const NODE_EXCLUDE = ["**/node_modules/**", "**/dist/**"];

function unitProject(name, include) {
  return defineProject({
    test: {
      name,
      globals: true,
      environment: "node",
      include: [include],
      exclude: NODE_EXCLUDE,
      passWithNoTests: true,
    },
  });
}

function integrationProject(name, include) {
  return defineProject({
    test: {
      name,
      globals: true,
      environment: "node",
      include: [include],
      exclude: NODE_EXCLUDE,
      passWithNoTests: true,
      testTimeout: 30_000,
      hookTimeout: 30_000,
      pool: "forks",
      fileParallelism: false,
    },
  });
}

const workspaceProjects = [
  unitProject("common", "packages/common/tests/**/*.test.ts"),
  unitProject("identity", "packages/domains/identity/tests/**/*.test.ts"),
  unitProject("assets", "packages/domains/assets/tests/**/*.test.ts"),
  unitProject("ledger", "packages/domains/ledger/tests/**/*.test.ts"),
  unitProject("accounting", "packages/domains/accounting/tests/**/*.test.ts"),
  unitProject("balances", "packages/domains/balances/tests/**/*.test.ts"),
  unitProject("reconciliation", "packages/domains/reconciliation/tests/**/*.test.ts"),
  unitProject("documents", "packages/domains/documents/tests/**/*.test.ts"),
  unitProject("parties", "packages/domains/parties/tests/**/*.test.ts"),
  unitProject("treasury", "packages/domains/treasury/tests/**/*.test.ts"),
  unitProject("reporting", "packages/domains/reporting/tests/**/*.test.ts"),
  integrationProject("accounting:integration", "packages/domains/accounting/tests/**/*.integration.test.ts"),
  integrationProject("balances:integration", "packages/domains/balances/tests/**/*.integration.test.ts"),
  integrationProject("customers:integration", "packages/domains/parties/tests/customers/integration/**/*.test.ts"),
  integrationProject("fees:integration", "packages/domains/treasury/tests/fees/integration/**/*.test.ts"),
  integrationProject("fx:integration", "packages/domains/treasury/tests/fx/integration/**/*.test.ts"),
  integrationProject("ledger:integration", "packages/domains/ledger/tests/**/*.integration.test.ts"),
  integrationProject("reconciliation:integration", "packages/domains/reconciliation/tests/**/*.integration.test.ts"),
];

export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.config.ts",
      "apps/workers/vitest.config.ts",
      "packages/db/vitest.config.ts",
      ...workspaceProjects,
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
  },
});
