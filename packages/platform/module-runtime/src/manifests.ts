import type { ModuleManifest } from "./types";

export const BEDROCK_MODULE_MANIFESTS = [
  {
    id: "system-modules",
    version: 1,
    description: "Module runtime control plane",
    enabledByDefault: true,
    mutable: false,
    dependencies: [],
  },
  {
    id: "ledger",
    version: 1,
    description: "Ledger execution runtime",
    enabledByDefault: true,
    dependencies: [],
  },
  {
    id: "accounting",
    version: 1,
    description: "Accounting runtime",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "ledger",
        required: true,
        reason: "Accounting posting is persisted through ledger operations",
      },
    ],
  },
  {
    id: "accounting-reporting",
    version: 1,
    description: "Accounting reporting service",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "accounting",
        required: true,
        reason: "Reporting depends on accounting data model",
      },
    ],
  },
  {
    id: "documents",
    version: 1,
    description: "Workflow documents runtime",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "accounting",
        required: true,
        reason: "Documents post through accounting runtime",
      },
      {
        moduleId: "ledger",
        required: true,
        reason: "Documents posting writes ledger operations",
      },
    ],
  },
  {
    id: "accounts",
    version: 1,
    description: "Operational accounts module",
    enabledByDefault: true,
    dependencies: [],
  },
  {
    id: "account-providers",
    version: 1,
    description: "Operational account provider module",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "accounts",
        required: true,
        reason: "Providers are bound to operational accounts",
      },
    ],
  },
  {
    id: "counterparties",
    version: 1,
    description: "Counterparties module",
    enabledByDefault: true,
    dependencies: [],
  },
  {
    id: "counterparty-groups",
    version: 1,
    description: "Counterparty groups module",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "counterparties",
        required: true,
        reason: "Groups aggregate counterparties",
      },
    ],
  },
  {
    id: "customers",
    version: 1,
    description: "Customers module",
    enabledByDefault: true,
    dependencies: [],
  },
  {
    id: "currencies",
    version: 1,
    description: "Currencies module",
    enabledByDefault: true,
    dependencies: [],
  },
  {
    id: "fees",
    version: 1,
    description: "Fees runtime",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "currencies",
        required: true,
        reason: "Fee rules are currency-bound",
      },
    ],
  },
  {
    id: "fx",
    version: 1,
    description: "FX runtime",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "fees",
        required: true,
        reason: "FX quotes include fee components",
      },
      {
        moduleId: "currencies",
        required: true,
        reason: "FX pairs require currencies",
      },
    ],
  },
  {
    id: "fx-rates",
    version: 1,
    description: "FX rates module and worker",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "fx",
        required: true,
        reason: "Rates sync is part of FX runtime",
      },
    ],
  },
  {
    id: "connectors",
    version: 1,
    description: "Payment provider connectors runtime",
    enabledByDefault: true,
    dependencies: [],
  },
  {
    id: "orchestration",
    version: 1,
    description: "Payment routing orchestration runtime",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "connectors",
        required: true,
        reason: "Routing decisions and retries depend on connector state",
      },
    ],
  },
  {
    id: "payments",
    version: 1,
    description: "Payments workflow module",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "documents",
        required: true,
        reason: "Payments are implemented as document workflows",
      },
      {
        moduleId: "connectors",
        required: true,
        reason: "Posted payments create connector intents",
      },
      {
        moduleId: "orchestration",
        required: true,
        reason: "Posted payments require routing",
      },
    ],
  },
  {
    id: "balances",
    version: 1,
    description: "Balances runtime and projector",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "ledger",
        required: true,
        reason: "Balances project from ledger events",
      },
    ],
  },
  {
    id: "reconciliation",
    version: 1,
    description: "Reconciliation runtime",
    enabledByDefault: true,
    dependencies: [
      {
        moduleId: "documents",
        required: true,
        reason: "Reconciliation uses document workflows for adjustments",
      },
    ],
  },
] as const satisfies ModuleManifest[];

export type BedrockModuleId = (typeof BEDROCK_MODULE_MANIFESTS)[number]["id"];
