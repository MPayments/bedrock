export function normalizeReportCurrency(
  value: string | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.trim().toUpperCase();
}
