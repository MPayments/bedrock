import {
  IFRS_DOCUMENT_METADATA,
  type IfrsDocumentType,
} from "@bedrock/application/ifrs-documents/contracts";

export type DocumentTypeFamily = "transfers" | "ifrs" | "payments";

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

export function createIfrsDocumentTypeOption(
  docType: IfrsDocumentType,
): DocumentTypeOption {
  const metadata = IFRS_DOCUMENT_METADATA[docType];

  return {
    value: docType,
    label: metadata.label,
    family: metadata.family,
    creatable: metadata.creatable,
    hasTypedForm: metadata.hasTypedForm,
    adminOnly: metadata.adminOnly || undefined,
  };
}
