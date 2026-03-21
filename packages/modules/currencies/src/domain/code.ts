import { type Brand, invariant } from "@bedrock/shared/core/domain";

const CURRENCY_PATTERN = /^[A-Z0-9_]{2,16}$/;

export type CurrencyCode = Brand<string, "CurrencyCode">;
export type Currency = CurrencyCode;

export function normalizeCurrencyCode(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  invariant(
    CURRENCY_PATTERN.test(normalized),
    `Invalid currency code: ${currency}. Must be 2-16 uppercase alphanumeric characters or underscores.`,
    {
      code: "currency.invalid_code",
      meta: { currency },
    },
  );
  return normalized;
}

export function normalizeCurrency(currency: string): string {
  return normalizeCurrencyCode(currency);
}

export function isValidCurrencyCode(currency: string): boolean {
  try {
    normalizeCurrencyCode(currency);
    return true;
  } catch {
    return false;
  }
}

export function isValidCurrency(currency: string): boolean {
  return isValidCurrencyCode(currency);
}

export function parseCurrencyCode(currency: string): CurrencyCode {
  return normalizeCurrencyCode(currency) as CurrencyCode;
}

export function parseCurrency(currency: string): Currency {
  return parseCurrencyCode(currency);
}
