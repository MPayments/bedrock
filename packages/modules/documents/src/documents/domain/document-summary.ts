export interface DocumentSummaryFields {
  title: string;
  amountMinor?: bigint | null;
  currency?: string | null;
  memo?: string | null;
  counterpartyId?: string | null;
  customerId?: string | null;
  organizationRequisiteId?: string | null;
  searchText: string;
}

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function buildSummary(summary: DocumentSummaryFields) {
  return {
    title: summary.title,
    amountMinor: summary.amountMinor ?? null,
    currency: summary.currency ?? null,
    memo: summary.memo ?? null,
    counterpartyId: summary.counterpartyId ?? null,
    customerId: summary.customerId ?? null,
    organizationRequisiteId: summary.organizationRequisiteId ?? null,
    searchText: normalizeSearchText(summary.searchText),
  };
}
