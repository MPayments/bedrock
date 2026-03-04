import {
  BEDROCK_CORE_MODULE_MANIFESTS,
  type ModuleManifest,
} from "@bedrock/core/module-runtime";

export const BEDROCK_APPLICATION_MODULE_MANIFESTS = [
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
        moduleId: "accounting",

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
        moduleId: "currencies",

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
        moduleId: "fees",

        reason: "FX quotes include fee components",
      },
      {
        moduleId: "currencies",

        reason: "FX pairs require currencies",
      },
    ],
  },
  {
    id: "fx-rates",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "FX rates module and worker",
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
        moduleId: "fx",

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
        moduleId: "documents",

        reason: "IFRS workflows are executed through the documents runtime",
      },
      {
        moduleId: "counterparty-accounts",

        reason: "Transfer and funding modules resolve counterparty account bindings",
      },
    ],
  },
  {
    id: "payments",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Payments workflow module",
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
        moduleId: "documents",

        reason: "Payments are implemented as document workflows",
      },
    ],
  },
] as const satisfies ModuleManifest[];

export const BEDROCK_MODULE_MANIFESTS = [
  ...BEDROCK_CORE_MODULE_MANIFESTS,
  ...BEDROCK_APPLICATION_MODULE_MANIFESTS,
] as const satisfies ModuleManifest[];

export type BedrockApplicationModuleId =
  (typeof BEDROCK_APPLICATION_MODULE_MANIFESTS)[number]["id"];
export type BedrockModuleId =
  (typeof BEDROCK_MODULE_MANIFESTS)[number]["id"];
