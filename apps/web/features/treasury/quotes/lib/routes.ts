export function buildTreasuryQuoteDetailsHref(quoteRef: string) {
  return `/treasury/quotes/${encodeURIComponent(quoteRef)}`;
}
