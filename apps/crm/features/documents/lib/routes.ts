export function buildCrmDealDocumentCreateHref(
  dealId: string,
  docType: string,
  options?: {
    invoicePurpose?: "combined" | "principal" | "agency_fee" | null;
  },
): string {
  const query = new URLSearchParams({ docType });
  if (options?.invoicePurpose) {
    query.set("invoicePurpose", options.invoicePurpose);
  }

  return `/deals/${encodeURIComponent(dealId)}/documents/create?${query.toString()}`;
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
