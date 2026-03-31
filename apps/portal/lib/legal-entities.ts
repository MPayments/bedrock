function normalizeComparableName(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

export function isDuplicateCustomerLegalEntityName(input: {
  customerDisplayName: string;
  legalEntityName: string;
}): boolean {
  return (
    normalizeComparableName(input.customerDisplayName) ===
    normalizeComparableName(input.legalEntityName)
  );
}

export function formatCustomerLegalEntityLabel(input: {
  customerDisplayName: string;
  legalEntityName: string;
}): string {
  return isDuplicateCustomerLegalEntityName(input)
    ? input.legalEntityName
    : `${input.customerDisplayName} / ${input.legalEntityName}`;
}
