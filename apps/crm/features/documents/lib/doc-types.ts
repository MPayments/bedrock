import { COMMERCIAL_DOCUMENT_METADATA } from "@bedrock/plugin-documents-commercial/contracts";

const CRM_DOC_TYPES = [
  "application",
  "invoice",
  "acceptance",
  "exchange",
] as const;
export type CrmDocType = (typeof CRM_DOC_TYPES)[number];

export function isCrmDocType(value: string): value is CrmDocType {
  return (CRM_DOC_TYPES as readonly string[]).includes(value);
}

export function canCreateCrmDocumentType(docType: string): boolean {
  if (!isCrmDocType(docType)) return false;
  const metadata = COMMERCIAL_DOCUMENT_METADATA[docType];
  return metadata.creatable && !metadata.adminOnly;
}

export function getCrmDocumentTypeLabel(docType: string): string {
  if (isCrmDocType(docType)) {
    return COMMERCIAL_DOCUMENT_METADATA[docType].label;
  }
  return docType;
}
