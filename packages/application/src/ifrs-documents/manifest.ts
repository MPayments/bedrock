import type { ModuleManifest } from "@bedrock/core/module-runtime";

export const IFRS_DOCUMENTS_MODULE_MANIFEST = {
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
} as const satisfies ModuleManifest;
