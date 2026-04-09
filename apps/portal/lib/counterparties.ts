function normalizeComparableName(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

export function isDuplicateCustomerCounterpartyName(input: {
  customerDisplayName: string;
  counterpartyName: string;
}): boolean {
  return (
    normalizeComparableName(input.customerDisplayName) ===
    normalizeComparableName(input.counterpartyName)
  );
}

export function formatCustomerCounterpartyLabel(input: {
  customerDisplayName: string;
  counterpartyName: string;
}): string {
  return isDuplicateCustomerCounterpartyName(input)
    ? input.counterpartyName
    : `${input.customerDisplayName} / ${input.counterpartyName}`;
}
