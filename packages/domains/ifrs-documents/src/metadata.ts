export const IFRS_ALL_DOCUMENT_TYPES = [
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
] as const;

export type IfrsDocumentType = (typeof IFRS_ALL_DOCUMENT_TYPES)[number];

export const IFRS_DOCUMENT_TYPE_ORDER = [
  "transfer_intra",
  "transfer_intercompany",
  "transfer_resolution",
  "capital_funding",
  "period_close",
  "period_reopen",
] as const satisfies readonly IfrsDocumentType[];

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

const IFRS_DOCUMENT_METADATA_ENTRIES = [
  {
    docType: "transfer_intra",
    label: "Внутренний перевод",
    family: "transfers",
    docNoPrefix: "TRI",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "transfer_intercompany",
    label: "Межкорпоративный перевод",
    family: "transfers",
    docNoPrefix: "TRX",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "transfer_resolution",
    label: "Разрешение перевода",
    family: "transfers",
    docNoPrefix: "TRR",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "capital_funding",
    label: "Капитальное финансирование",
    family: "ifrs",
    docNoPrefix: "CAP",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "intercompany_loan_drawdown",
    label: "Выдача межкорпоративного займа",
    family: "ifrs",
    docNoPrefix: "ILD",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "intercompany_loan_repayment",
    label: "Погашение межкорпоративного займа",
    family: "ifrs",
    docNoPrefix: "ILR",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "intercompany_interest_accrual",
    label: "Начисление межкорпоративных процентов",
    family: "ifrs",
    docNoPrefix: "IIA",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "intercompany_interest_settlement",
    label: "Расчет по межкорпоративным процентам",
    family: "ifrs",
    docNoPrefix: "IIS",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "equity_contribution",
    label: "Вклад в капитал",
    family: "ifrs",
    docNoPrefix: "ECO",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "equity_distribution",
    label: "Распределение капитала",
    family: "ifrs",
    docNoPrefix: "EDI",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "accrual_adjustment",
    label: "Корректировка начислений",
    family: "ifrs",
    docNoPrefix: "AAC",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "revaluation_adjustment",
    label: "Корректировка переоценки",
    family: "ifrs",
    docNoPrefix: "ARV",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "impairment_adjustment",
    label: "Корректировка обесценения",
    family: "ifrs",
    docNoPrefix: "AIM",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "closing_reclass",
    label: "Закрывающая реклассификация",
    family: "ifrs",
    docNoPrefix: "ACR",
    creatable: true,
    hasTypedForm: true,
    adminOnly: false,
  },
  {
    docType: "period_close",
    label: "Закрытие периода",
    family: "ifrs",
    docNoPrefix: "PCL",
    creatable: false,
    hasTypedForm: false,
    adminOnly: true,
  },
  {
    docType: "period_reopen",
    label: "Переоткрытие периода",
    family: "ifrs",
    docNoPrefix: "PRN",
    creatable: true,
    hasTypedForm: true,
    adminOnly: true,
  },
] as const satisfies readonly IfrsDocumentMetadata[];

export const IFRS_DOCUMENT_METADATA = Object.freeze(
  Object.fromEntries(
    IFRS_DOCUMENT_METADATA_ENTRIES.map((entry) => [entry.docType, entry]),
  ) as Record<IfrsDocumentType, IfrsDocumentMetadata>,
);
