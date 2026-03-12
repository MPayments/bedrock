export const SYSTEM_ONLY_DOCUMENT_TYPES = [
  "period_close",
  "period_reopen",
] as const;

const SYSTEM_ONLY_DOCUMENT_TYPE_SET = new Set<string>(
  SYSTEM_ONLY_DOCUMENT_TYPES,
);

export function isSystemOnlyDocumentType(docType: string): boolean {
  return SYSTEM_ONLY_DOCUMENT_TYPE_SET.has(docType);
}
