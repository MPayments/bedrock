import type { ComponentManifest } from "./types";

export const BEDROCK_CORE_COMPONENT_MANIFESTS = [
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
      workers: [
        {
          id: "ledger",
          envKey: "LEDGER_WORKER_INTERVAL_MS",
          defaultIntervalMs: 5_000,
          description: "Posts pending ledger operations to TigerBeetle.",
        },
      ],
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
    id: "documents",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Workflow documents runtime",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      workers: [
        {
          id: "documents",
          envKey: "DOCUMENTS_WORKER_INTERVAL_MS",
          defaultIntervalMs: 5_000,
          description: "Finalizes document posting states from ledger results.",
        },
        {
          id: "documents-period-close",
          envKey: "DOCUMENTS_PERIOD_CLOSE_WORKER_INTERVAL_MS",
          defaultIntervalMs: 60_000,
          description:
            "Generates monthly period_close documents and closes counterparty periods.",
        },
      ],
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
    id: "counterparty-accounts",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Counterparty accounts component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-accounts",
      },
    },
    dependencies: [],
  },
  {
    id: "counterparty-account-providers",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Counterparty account providers component",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-account-providers",
      },
    },
    dependencies: [
      {
        componentId: "counterparty-accounts",

        reason: "Providers are bound to counterparty accounts",
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
        {
          id: "connectors-dispatch",
          envKey: "CONNECTORS_DISPATCH_WORKER_INTERVAL_MS",
          defaultIntervalMs: 5_000,
          description: "Dispatches queued connector attempts to providers.",
        },
        {
          id: "connectors-poller",
          envKey: "CONNECTORS_STATUS_POLLER_INTERVAL_MS",
          defaultIntervalMs: 10_000,
          description:
            "Polls provider statuses for pending connector attempts.",
        },
        {
          id: "connectors-statements",
          envKey: "CONNECTORS_STATEMENT_INGEST_INTERVAL_MS",
          defaultIntervalMs: 60_000,
          description: "Ingests provider statements via connector cursors.",
        },
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
      workers: [
        {
          id: "orchestration-retry",
          envKey: "ORCHESTRATION_WORKER_INTERVAL_MS",
          defaultIntervalMs: 5_000,
          description: "Schedules retry/fallback attempts for failed routing.",
        },
      ],
    },
    dependencies: [
      {
        componentId: "connectors",

        reason: "Routing decisions and retries depend on connector state",
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
      workers: [
        {
          id: "balances",
          envKey: "BALANCES_WORKER_INTERVAL_MS",
          defaultIntervalMs: 5_000,
          description: "Projects posted ledger entries into balance positions.",
        },
      ],
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
      workers: [
        {
          id: "reconciliation",
          envKey: "RECONCILIATION_WORKER_INTERVAL_MS",
          defaultIntervalMs: 60_000,
          description:
            "Runs reconciliation batches for pending external records.",
        },
      ],
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

export type BedrockCoreComponentId =
  (typeof BEDROCK_CORE_COMPONENT_MANIFESTS)[number]["id"];
