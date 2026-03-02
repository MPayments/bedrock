import type { ComponentManifest } from "./types";


export const BEDROCK_COMPONENT_MANIFESTS = [
  {
    id: "system-components",
    version: 2,
    kind: "control",
    mutability: "immutable",
    description: "Component runtime control plane",
    enabledByDefault: true,
    scopeSupport: { global: true, book: false },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/system/components",
        guarded: false,
      },
    },
    dependencies: [],
  },
  {
    id: "idempotency",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Idempotency kernel",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {},
    dependencies: [],
  },
  {
    id: "ledger",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Ledger execution runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      workers: ["ledger"],
    },
    dependencies: [],
  },
  {
    id: "accounting",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Accounting runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/accounting",
      },
    },
    dependencies: [
      {
        componentId: "ledger",

        reason: "Accounting posting is persisted through ledger operations",
      },
      {
        componentId: "idempotency",

        reason: "Accounting writes rely on idempotent operation semantics",
      },
    ],
  },
  {
    id: "accounting-reporting",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Accounting reporting service",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/accounting",
      },
    },
    dependencies: [
      {
        componentId: "accounting",

        reason: "Reporting depends on accounting data model",
      },
    ],
  },
  {
    id: "documents",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Workflow documents runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      workers: ["documents"],
    },
    dependencies: [
      {
        componentId: "accounting",

        reason: "Documents post through accounting runtime",
      },
      {
        componentId: "ledger",

        reason: "Documents posting writes ledger operations",
      },
      {
        componentId: "idempotency",

        reason: "Document actions use idempotent action receipts",
      },
    ],
  },
  {
    id: "accounts",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Operational accounts component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/accounts",
      },
    },
    dependencies: [],
  },
  {
    id: "account-providers",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Operational account provider component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/account-providers",
      },
    },
    dependencies: [
      {
        componentId: "accounts",

        reason: "Providers are bound to operational accounts",
      },
    ],
  },
  {
    id: "counterparties",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Counterparties component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparties",
      },
    },
    dependencies: [],
  },
  {
    id: "counterparty-groups",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Counterparty groups component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-groups",
      },
    },
    dependencies: [
      {
        componentId: "counterparties",

        reason: "Groups aggregate counterparties",
      },
    ],
  },
  {
    id: "customers",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Customers component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/customers",
      },
    },
    dependencies: [],
  },
  {
    id: "currencies",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Currencies component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/currencies",
      },
    },
    dependencies: [],
  },
  {
    id: "fees",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Fees runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {},
    dependencies: [
      {
        componentId: "currencies",

        reason: "Fee rules are currency-bound",
      },
    ],
  },
  {
    id: "fx",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "FX runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {},
    dependencies: [
      {
        componentId: "fees",

        reason: "FX quotes include fee components",
      },
      {
        componentId: "currencies",

        reason: "FX pairs require currencies",
      },
    ],
  },
  {
    id: "fx-rates",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "FX rates component and worker",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/fx/rates",
      },
      workers: ["fx-rates"],
    },
    dependencies: [
      {
        componentId: "fx",

        reason: "Rates sync is part of FX runtime",
      },
    ],
  },
  {
    id: "connectors",
    version: 1,
    kind: "integration",
    mutability: "mutable",
    description: "Payment provider connectors runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/connectors",
      },
      workers: [
        "connectors-dispatch",
        "connectors-poller",
        "connectors-statements",
      ],
    },
    dependencies: [
      {
        componentId: "idempotency",

        reason: "Connector writes rely on deterministic idempotency receipts",
      },
    ],
  },
  {
    id: "orchestration",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Payment routing orchestration runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/orchestration",
      },
      workers: ["orchestration-retry"],
    },
    dependencies: [
      {
        componentId: "connectors",

        reason: "Routing decisions and retries depend on connector state",
      },
    ],
  },
  {
    id: "payments",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Payments workflow component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/payments",
      },
      documentModules: ["payment_intent", "payment_resolution"],
    },
    dependencies: [
      {
        componentId: "documents",

        reason: "Payments are implemented as document workflows",
      },
      {
        componentId: "connectors",

        reason: "Posted payments create connector intents",
      },
      {
        componentId: "orchestration",

        reason: "Posted payments require routing",
      },
    ],
  },
  {
    id: "balances",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Balances runtime and projector",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/balances",
      },
      workers: ["balances"],
    },
    dependencies: [
      {
        componentId: "ledger",

        reason: "Balances project from ledger events",
      },
    ],
  },
  {
    id: "reconciliation",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Reconciliation runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/reconciliation",
      },
      workers: ["reconciliation"],
    },
    dependencies: [
      {
        componentId: "documents",

        reason: "Reconciliation uses document workflows for adjustments",
      },
      {
        componentId: "idempotency",

        reason: "Reconciliation writes are idempotent",
      },
    ],
  },
] as const satisfies ComponentManifest[];

export type BedrockComponentId =
  (typeof BEDROCK_COMPONENT_MANIFESTS)[number]["id"];
