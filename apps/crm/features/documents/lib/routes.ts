export function buildCrmDealDocumentCreateHref(
  dealId: string,
  docType: string,
): string {
  return `/deals/${encodeURIComponent(dealId)}/documents/create?docType=${encodeURIComponent(docType)}`;
}

export function buildCrmDealDocumentDetailsHref(
  dealId: string,
  docType: string,
  documentId: string,
): string {
  return `/deals/${encodeURIComponent(dealId)}/documents/${encodeURIComponent(docType)}/${encodeURIComponent(documentId)}`;
}

export function buildCrmDealDocumentsTabHref(dealId: string): string {
  return `/deals/${encodeURIComponent(dealId)}?tab=documents`;
}
