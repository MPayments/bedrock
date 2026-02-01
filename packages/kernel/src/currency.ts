/**
 * Currency code utilities.
 * 
 * Currency codes follow ISO 4217 format: 2-16 uppercase alphanumeric characters.
 * Examples: USD, EUR, BTC, USDC_ETH
 */

const CURRENCY_PATTERN = /^[A-Z0-9_]{2,16}$/;

/**
 * Normalize a currency code to uppercase and validate format.
 * @throws Error if currency code is invalid
 */
export function normalizeCurrency(currency: string): string {
    const normalized = currency.trim().toUpperCase();
    if (!CURRENCY_PATTERN.test(normalized)) {
        throw new Error(`Invalid currency code: ${currency}. Must be 2-16 uppercase alphanumeric characters or underscores.`);
    }
    return normalized;
}

/**
 * Check if a string is a valid currency code.
 */
export function isValidCurrency(currency: string): boolean {
    try {
        normalizeCurrency(currency);
        return true;
    } catch {
        return false;
    }
}

/**
 * Currency code branded type for type-safe currency handling.
 */
export type Currency = string & { readonly __brand: "Currency" };

/**
 * Parse and validate a currency code, returning a branded type.
 * @throws Error if currency code is invalid
 */
export function parseCurrency(currency: string): Currency {
    return normalizeCurrency(currency) as Currency;
}
