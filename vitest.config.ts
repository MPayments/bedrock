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
  unitProject("countries", "packages/framework/kernel/tests/countries/**/*.test.ts"),
  unitProject("accounting", "packages/framework/accounting/tests/**/*.test.ts"),
  unitProject("balances", "packages/framework/balances/tests/**/*.test.ts"),
  unitProject("module-runtime", "packages/framework/modules/tests/**/*.test.ts"),
  unitProject("counterparties", "packages/domains/counterparties/tests/**/*.test.ts"),
  unitProject("currencies", "packages/framework/assets/tests/**/*.test.ts"),
  unitProject("customers", "packages/domains/customers/tests/**/*.test.ts"),
  unitProject("dimensions", "packages/framework/registers/tests/**/*.test.ts"),
  unitProject("documents", "packages/framework/documents/tests/**/*.test.ts"),
  unitProject("idempotency", "packages/framework/operations/tests/**/*.test.ts"),
  unitProject("ledger", "packages/framework/ledger/tests/**/*.test.ts"),
  unitProject("counterparty-accounts", "packages/domains/counterparties/tests/counterparty-accounts/**/*.test.ts"),
  unitProject("reconciliation", "packages/framework/reconciliation/tests/**/*.test.ts"),
  unitProject("accounting-reporting", "packages/domains/accounting-reporting/tests/**/*.test.ts"),
  unitProject("fees", "packages/domains/fees/tests/**/*.test.ts"),
  unitProject("fx", "packages/domains/fx/tests/**/*.test.ts"),
  unitProject("payments", "packages/domains/payments/tests/**/*.test.ts"),
  integrationProject("accounting:integration", "packages/framework/accounting/tests/integration/**/*.test.ts"),
  integrationProject("balances:integration", "packages/framework/balances/tests/integration/**/*.test.ts"),
  integrationProject("customers:integration", "packages/domains/customers/tests/integration/**/*.test.ts"),
  integrationProject("fees:integration", "packages/domains/fees/tests/integration/**/*.test.ts"),
  integrationProject("fx:integration", "packages/domains/fx/tests/integration/**/*.test.ts"),
  integrationProject("ledger:integration", "packages/framework/ledger/tests/integration/**/*.test.ts"),
  integrationProject("reconciliation:integration", "packages/framework/reconciliation/tests/integration/**/*.test.ts"),
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
