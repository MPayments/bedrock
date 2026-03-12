import {
  COMMERCIAL_DOCUMENT_METADATA,
  type CommercialDocumentType,
} from "@bedrock/application/commercial-documents/contracts";
import {
  IFRS_DOCUMENT_METADATA,
  type IfrsDocumentType,
} from "@bedrock/application/ifrs-documents/contracts";

export type DocumentTypeFamily = "transfers" | "ifrs" | "commercial";

export type KnownDocumentType = IfrsDocumentType | CommercialDocumentType;

export type TypedDocumentType = KnownDocumentType;

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

export function createCommercialDocumentTypeOption(
  docType: CommercialDocumentType,
): DocumentTypeOption {
  const metadata = COMMERCIAL_DOCUMENT_METADATA[docType];

  return {
    value: docType,
    label: metadata.label,
    family: metadata.family,
    creatable: metadata.creatable,
    hasTypedForm: metadata.hasTypedForm,
    adminOnly: metadata.adminOnly || undefined,
  };
}
