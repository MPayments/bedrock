import type { UserRole } from "@/lib/auth/types";

export type DocumentTypeFamily = "transfers" | "ifrs" | "payments";

export type IfrsDocumentType =
  | "transfer_intra"
  | "transfer_intercompany"
  | "transfer_resolution"
  | "capital_funding"
  | "intercompany_loan_drawdown"
  | "intercompany_loan_repayment"
  | "intercompany_interest_accrual"
  | "intercompany_interest_settlement"
  | "equity_contribution"
  | "equity_distribution"
  | "accrual_adjustment"
  | "revaluation_adjustment"
  | "impairment_adjustment"
  | "closing_reclass"
  | "period_close"
  | "period_reopen";

export type KnownDocumentType =
  | IfrsDocumentType
  | "payment_intent"
  | "payment_resolution";

export type TypedDocumentType = Exclude<IfrsDocumentType, "period_close">;

export type DocumentTypeOption = {
  value: KnownDocumentType;
  label: string;
  family: DocumentTypeFamily;
  creatable: boolean;
  hasTypedForm: boolean;
  adminOnly?: boolean;
};

const DOCUMENT_TYPES: DocumentTypeOption[] = [
  {
    value: "transfer_intra",
    label: "Внутренний перевод",
    family: "transfers",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "transfer_intercompany",
    label: "Межкорпоративный перевод",
    family: "transfers",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "transfer_resolution",
    label: "Разрешение перевода",
    family: "transfers",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "capital_funding",
    label: "Капитальное финансирование",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "intercompany_loan_drawdown",
    label: "Выдача межкорпоративного займа",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "intercompany_loan_repayment",
    label: "Погашение межкорпоративного займа",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "intercompany_interest_accrual",
    label: "Начисление межкорпоративных процентов",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "intercompany_interest_settlement",
    label: "Расчет по межкорпоративным процентам",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "equity_contribution",
    label: "Вклад в капитал",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "equity_distribution",
    label: "Распределение капитала",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "accrual_adjustment",
    label: "Корректировка начислений",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "revaluation_adjustment",
    label: "Корректировка переоценки",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "impairment_adjustment",
    label: "Корректировка обесценения",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "closing_reclass",
    label: "Закрывающая реклассификация",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
  },
  {
    value: "period_close",
    label: "Закрытие периода",
    family: "ifrs",
    creatable: false,
    hasTypedForm: false,
    adminOnly: true,
  },
  {
    value: "period_reopen",
    label: "Переоткрытие периода",
    family: "ifrs",
    creatable: true,
    hasTypedForm: true,
    adminOnly: true,
  },
  {
    value: "payment_intent",
    label: "Платежное намерение",
    family: "payments",
    creatable: false,
    hasTypedForm: false,
  },
  {
    value: "payment_resolution",
    label: "Разрешение платежа",
    family: "payments",
    creatable: false,
    hasTypedForm: false,
  },
];

export const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.filter(
  (option) => option.family !== "payments" && option.value !== "period_close",
);

const DOCUMENT_TYPE_BY_ID = new Map(
  DOCUMENT_TYPES.map((option) => [option.value, option]),
);

const KNOWN_DOCUMENT_TYPE_SET = new Set(
  DOCUMENT_TYPES.map((option) => option.value),
);

const TYPED_DOCUMENT_TYPE_SET = new Set(
  DOCUMENT_TYPES.filter((option) => option.hasTypedForm).map((option) => option.value),
);

const CREATABLE_DOCUMENT_TYPE_SET = new Set(
  DOCUMENT_TYPES.filter((option) => option.creatable).map((option) => option.value),
);

function isAllowedForRole(option: DocumentTypeOption, role: UserRole): boolean {
  if (!option.adminOnly) {
    return true;
  }

  return role === "admin";
}

export function isKnownDocumentType(docType: string): docType is KnownDocumentType {
  return KNOWN_DOCUMENT_TYPE_SET.has(docType as KnownDocumentType);
}

export function getDocumentTypeLabel(docType: string): string {
  return DOCUMENT_TYPE_BY_ID.get(docType as KnownDocumentType)?.label ?? docType;
}

export function getDocumentTypeFamily(docType: string): DocumentTypeFamily | null {
  return DOCUMENT_TYPE_BY_ID.get(docType as KnownDocumentType)?.family ?? null;
}

export function isIfrsWorkflowDocumentType(docType: string): boolean {
  const family = getDocumentTypeFamily(docType);
  return family === "ifrs" || family === "transfers";
}

export function getTypeListDocumentOptions(role: UserRole): DocumentTypeOption[] {
  return DOCUMENT_TYPE_OPTIONS.filter((option) => isAllowedForRole(option, role));
}

export function getCreateDocumentTypeOptions(role: UserRole): DocumentTypeOption[] {
  return DOCUMENT_TYPE_OPTIONS.filter(
    (option) => option.creatable && isAllowedForRole(option, role),
  );
}

export function hasTypedDocumentForm(
  docType: string,
  role: UserRole,
): docType is TypedDocumentType {
  if (!TYPED_DOCUMENT_TYPE_SET.has(docType as TypedDocumentType)) {
    return false;
  }

  const option = DOCUMENT_TYPE_BY_ID.get(docType as KnownDocumentType);
  if (!option) {
    return false;
  }

  return isAllowedForRole(option, role);
}

export function canCreateDocumentType(docType: string, role: UserRole): boolean {
  if (!CREATABLE_DOCUMENT_TYPE_SET.has(docType as KnownDocumentType)) {
    return false;
  }

  const option = DOCUMENT_TYPE_BY_ID.get(docType as KnownDocumentType);
  if (!option) {
    return false;
  }

  return isAllowedForRole(option, role);
}

export function isAdminOnlyDocumentType(docType: string): boolean {
  return DOCUMENT_TYPE_BY_ID.get(docType as KnownDocumentType)?.adminOnly === true;
}
