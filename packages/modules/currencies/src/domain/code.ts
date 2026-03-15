const CURRENCY_PATTERN = /^[A-Z0-9_]{2,16}$/;

export type Currency = string & { readonly __brand: "Currency" };

export function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid currency code: ${currency}. Must be 2-16 uppercase alphanumeric characters or underscores.`,
    );
  }
  return normalized;
}

export function isValidCurrency(currency: string): boolean {
  try {
    normalizeCurrency(currency);
    return true;
  } catch {
    return false;
  }
}

export function parseCurrency(currency: string): Currency {
  return normalizeCurrency(currency) as Currency;
}
