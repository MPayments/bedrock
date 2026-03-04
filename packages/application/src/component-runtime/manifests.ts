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
    id: "ifrs-documents",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "IFRS treasury/accounting document modules",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      documentModules: [
        "transfer_intra",
        "transfer_intercompany",
        "transfer_resolution",
        "capital_funding",
        "intercompany_loan_drawdown",
        "intercompany_loan_repayment",
        "intercompany_interest_accrual",
        "intercompany_interest_settlement",
        "equity_contribution",
        "equity_distribution",
        "accrual_adjustment",
        "revaluation_adjustment",
        "impairment_adjustment",
        "closing_reclass",
        "period_close",
        "period_reopen",
      ],
    },
    dependencies: [
      {
        componentId: "documents",

        reason: "IFRS workflows are executed through the documents runtime",
      },
      {
        componentId: "counterparty-accounts",

        reason: "Transfer and funding modules resolve counterparty account bindings",
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
