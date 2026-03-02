import {
  BEDROCK_CORE_COMPONENT_MANIFESTS,
  type ComponentManifest,
} from "@bedrock/core/component-runtime";

export const BEDROCK_APPLICATION_COMPONENT_MANIFESTS = [
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
      workers: [
        {
          id: "fx-rates",
          envKey: "FX_RATES_WORKER_INTERVAL_MS",
          defaultIntervalMs: 60_000,
          description: "Refreshes stale FX rate sources.",
        },
      ],
    },
    dependencies: [
      {
        componentId: "fx",

        reason: "Rates sync is part of FX runtime",
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
] as const satisfies ComponentManifest[];

export const BEDROCK_COMPONENT_MANIFESTS = [
  ...BEDROCK_CORE_COMPONENT_MANIFESTS,
  ...BEDROCK_APPLICATION_COMPONENT_MANIFESTS,
] as const satisfies ComponentManifest[];

export type BedrockApplicationComponentId =
  (typeof BEDROCK_APPLICATION_COMPONENT_MANIFESTS)[number]["id"];
export type BedrockComponentId =
  (typeof BEDROCK_COMPONENT_MANIFESTS)[number]["id"];
