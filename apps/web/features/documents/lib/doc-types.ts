import type { UserRole } from "@/lib/auth/types";

import { IFRS_DOCUMENT_TYPE_OPTIONS } from "./doc-types/ifrs";
import type {
  DocumentTypeFamily,
  DocumentTypeOption,
  KnownDocumentType,
  TypedDocumentType,
} from "./doc-types/shared";

export type { TypedDocumentType } from "./doc-types/shared";
export type DocumentsWorkspaceFamily = Exclude<DocumentTypeFamily, "payments">;

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

export function isDocumentsWorkspaceFamily(
  family: string,
): family is DocumentsWorkspaceFamily {
  return family === "transfers" || family === "ifrs";
}

export function getDocumentsWorkspaceFamily(
  docType: string,
): DocumentsWorkspaceFamily | null {
  const family = getDocumentTypeFamily(docType);
  if (!family || family === "payments") {
    return null;
  }

  return family;
}

export function getDocumentsWorkspaceFamilyLabel(
  family: DocumentsWorkspaceFamily,
): string {
  if (family === "transfers") {
    return "Переводы";
  }

  return "Учетные документы";
}

export function getDocumentsWorkspaceTypesForFamily(
  family: DocumentsWorkspaceFamily,
  role: UserRole,
): DocumentTypeOption[] {
  return DOCUMENT_TYPES.filter(
    (option) =>
      option.family === family &&
      isAllowedForRole(option, role),
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

export function isAllowedDocumentsWorkspaceType(
  docType: string,
  family: DocumentsWorkspaceFamily,
  role: UserRole,
): docType is KnownDocumentType {
  if (!isKnownDocumentType(docType)) {
    return false;
  }

  const option = DOCUMENT_TYPE_BY_ID.get(docType);
  if (!option || option.family !== family) {
    return false;
  }

  return isAllowedForRole(option, role);
}
