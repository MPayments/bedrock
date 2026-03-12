import { defineConfig, defineProject } from "vitest/config";

const NODE_EXCLUDE = ["**/node_modules/**", "**/dist/**"];
const PROJECT_ROOT = new URL(".", import.meta.url).pathname;

function appProject(config) {
  return defineProject({
    root: PROJECT_ROOT,
    ...config,
  });
}

export const appUnitProjects = [
  appProject({
    test: {
      name: "accounting",
      globals: true,
      environment: "node",
      include: ["tests/accounting/**/*.test.ts"],
      exclude: ["tests/accounting/integration/**", ...NODE_EXCLUDE],
    },
  }),
  appProject({
    test: {
      name: "balances",
      globals: true,
      environment: "node",
      include: ["tests/balances/**/*.test.ts"],
      exclude: ["tests/balances/integration/**", ...NODE_EXCLUDE],
    },
  }),
  appProject({
    test: {
      name: "module-runtime",
      globals: true,
      environment: "node",
      include: ["tests/module-runtime/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  appProject({
    test: {
      name: "counterparties",
      globals: true,
      environment: "node",
      include: ["tests/counterparties/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  appProject({
    test: {
      name: "currencies",
      globals: true,
      environment: "node",
      include: ["tests/currencies/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  appProject({
    test: {
      name: "customers",
      globals: true,
      environment: "node",
      include: ["tests/customers/**/*.test.ts"],
      exclude: ["tests/customers/integration/**", ...NODE_EXCLUDE],
    },
  }),
  appProject({
    test: {
      name: "dimensions",
      globals: true,
      environment: "node",
      include: ["tests/dimensions/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  appProject({
    test: {
      name: "documents",
      globals: true,
      environment: "node",
      include: ["tests/documents/**/*.test.ts"],
      exclude: ["tests/documents/integration/**", ...NODE_EXCLUDE],
    },
  }),
  appProject({
    test: {
      name: "idempotency",
      globals: true,
      environment: "node",
      include: ["tests/idempotency/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
    },
  }),
  appProject({
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
  appProject({
    test: {
      name: "reconciliation",
      globals: true,
      environment: "node",
      include: ["tests/reconciliation/**/*.test.ts"],
      exclude: ["tests/reconciliation/integration/**", ...NODE_EXCLUDE],
    },
  }),
  appProject({
    test: {
      name: "accounting-reporting",
      globals: true,
      environment: "node",
      include: ["tests/accounting-reporting/**/*.test.ts"],
      exclude: NODE_EXCLUDE,
      passWithNoTests: true,
    },
  }),
  appProject({
    test: {
      name: "fees",
      globals: true,
      environment: "node",
      include: ["tests/fees/**/*.test.ts"],
      exclude: ["tests/fees/integration/**", ...NODE_EXCLUDE],
    },
  }),
  appProject({
    test: {
      name: "fx",
      globals: true,
      environment: "node",
      include: ["tests/fx/**/*.test.ts"],
      exclude: ["tests/fx/integration/**", ...NODE_EXCLUDE],
    },
  }),
  appProject({
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
    projects: appUnitProjects,
  },
});
