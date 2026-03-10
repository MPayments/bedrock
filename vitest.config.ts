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
  unitProject("common", "packages/bedrock/common/tests/**/*.test.ts"),
  unitProject("documents", "packages/bedrock/documents/tests/**/*.test.ts"),
  unitProject("finance", "packages/bedrock/finance/tests/**/*.test.ts"),
  unitProject("parties", "packages/domains/parties/tests/**/*.test.ts"),
  unitProject("treasury", "packages/domains/treasury/tests/**/*.test.ts"),
  unitProject("reporting", "packages/domains/reporting/tests/**/*.test.ts"),
  integrationProject("accounting:integration", "packages/bedrock/finance/tests/accounting/integration/**/*.test.ts"),
  integrationProject("balances:integration", "packages/bedrock/finance/tests/balances/integration/**/*.test.ts"),
  integrationProject("customers:integration", "packages/domains/parties/tests/customers/integration/**/*.test.ts"),
  integrationProject("fees:integration", "packages/domains/treasury/tests/fees/integration/**/*.test.ts"),
  integrationProject("fx:integration", "packages/domains/treasury/tests/fx/integration/**/*.test.ts"),
  integrationProject("ledger:integration", "packages/bedrock/finance/tests/ledger/integration/**/*.test.ts"),
  integrationProject("reconciliation:integration", "packages/bedrock/finance/tests/reconciliation/integration/**/*.test.ts"),
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
