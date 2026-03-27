export const COMMERCIAL_DOCUMENT_TYPES = [
  "incoming_invoice",
  "payment_order",
  "outgoing_invoice",
] as const;

export type CommercialDocumentType = (typeof COMMERCIAL_DOCUMENT_TYPES)[number];

export type CommercialDocumentFamily = "commercial";

export interface CommercialDocumentMetadata {
  docType: CommercialDocumentType;
  label: string;
  family: CommercialDocumentFamily;
  docNoPrefix: string;
  creatable: boolean;
  hasTypedForm: boolean;
  adminOnly: boolean;
}
