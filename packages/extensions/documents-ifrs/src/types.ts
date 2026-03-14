export const IFRS_ALL_DOCUMENT_TYPES = [
  "transfer_intra",
  "transfer_intercompany",
  "transfer_resolution",
  "fx_execute",
  "fx_resolution",
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
] as const;

export type IfrsDocumentType = (typeof IFRS_ALL_DOCUMENT_TYPES)[number];

export type IfrsDocumentFamily = "transfers" | "ifrs";

export interface IfrsDocumentMetadata {
  docType: IfrsDocumentType;
  label: string;
  family: IfrsDocumentFamily;
  docNoPrefix: string;
  creatable: boolean;
  hasTypedForm: boolean;
  adminOnly: boolean;
}
