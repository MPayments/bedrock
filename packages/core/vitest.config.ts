import { defineConfig, defineProject } from "vitest/config";

const NODE_EXCLUDE = ["**/node_modules/**", "**/dist/**"];
const PROJECT_ROOT = new URL(".", import.meta.url).pathname;

function coreProject(config) {
  return defineProject({
    root: PROJECT_ROOT,
    ...config,
  });
}

export const coreUnitProjects = [
  coreProject({
    test: {
      name: "accounting",
      globals: true,
      environment: "node",
      include: ["tests/accounting/**/*.test.ts"],
      exclude: ["tests/accounting/integration/**", ...NODE_EXCLUDE],
    },
  }),
  coreProject({
    test: {
      name: "balances",
      globals: true,
      environment: "node",
      include: ["tests/balances/**/*.test.ts"],
      exclude: ["tests/balances/integration/**", ...NODE_EXCLUDE],
    },
  }),
  coreProject({
    test: {
      name: "module-runtime",
      globals: true,
      environment: "node",
      include: ["tests/module-runtime/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  coreProject({
    test: {
      name: "counterparties",
      globals: true,
      environment: "node",
      include: ["tests/counterparties/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  coreProject({
    test: {
      name: "currencies",
      globals: true,
      environment: "node",
      include: ["tests/currencies/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  coreProject({
    test: {
      name: "customers",
      globals: true,
      environment: "node",
      include: ["tests/customers/**/*.test.ts"],
      exclude: ["tests/customers/integration/**", ...NODE_EXCLUDE],
    },
  }),
  coreProject({
    test: {
      name: "dimensions",
      globals: true,
      environment: "node",
      include: ["tests/dimensions/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  coreProject({
    test: {
      name: "documents",
      globals: true,
      environment: "node",
      include: ["tests/documents/**/*.test.ts"],
      exclude: ["tests/documents/integration/**", ...NODE_EXCLUDE],
    },
  }),
  coreProject({
    test: {
      name: "idempotency",
      globals: true,
      environment: "node",
      include: ["tests/idempotency/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  coreProject({
    test: {
      name: "ledger",
      globals: true,
      environment: "node",
      include: ["tests/ledger/**/*.test.ts", "tests/ledger/**/*.spec.ts"],
      exclude: ["tests/ledger/integration/**", ...NODE_EXCLUDE],
      mockReset: true,
      restoreMocks: true,
      clearMocks: true,
    },
  }),
  coreProject({
    test: {
      name: "reconciliation",
      globals: true,
      environment: "node",
      include: ["tests/reconciliation/**/*.test.ts"],
      exclude: ["tests/reconciliation/integration/**", ...NODE_EXCLUDE],
    },
  }),
];

export default defineConfig({
  test: {
    projects: coreUnitProjects,
  },
});
