import type { IfrsDocumentType } from "@bedrock/application/ifrs-documents/contracts";

import type { UserRole } from "@/lib/auth/types";

import { IFRS_DOCUMENT_TYPE_OPTIONS } from "./doc-types/ifrs";
import type {
  DocumentTypeFamily,
  DocumentTypeOption,
  KnownDocumentType,
  TypedDocumentType,
} from "./doc-types/shared";

export type {
  DocumentTypeFamily,
  DocumentTypeOption,
  KnownDocumentType,
  TypedDocumentType,
};

export type { IfrsDocumentType };

const PAYMENT_DOCUMENT_TYPES: DocumentTypeOption[] = [
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

const DOCUMENT_TYPES: DocumentTypeOption[] = [
  ...IFRS_DOCUMENT_TYPE_OPTIONS,
  ...PAYMENT_DOCUMENT_TYPES,
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
