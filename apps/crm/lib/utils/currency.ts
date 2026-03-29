/**
 * Centralized currency formatting utilities.
 * Replaces duplicated formatCurrency() implementations across the codebase.
 */

/** Map of currency codes to their symbols */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  RUB: "₽",
  CNY: "¥",
  TRY: "₺",
  AED: "د.إ",
};

/** Get the locale best suited for a given currency */
function getLocaleForCurrency(currencyCode: string): string {
  switch (currencyCode.toUpperCase()) {
    case "USD":
      return "en-US";
    case "EUR":
      return "de-DE";
    default:
      return "ru-RU";
  }
}

/**
 * Format a numeric amount with the correct currency symbol/code.
 * Uses Intl.NumberFormat for localized formatting.
 *
 * @param value - The numeric amount
 * @param currency - ISO currency code (e.g. "USD", "RUB")
 * @returns Formatted string like "1 234.56 ₽" or "$1,234.56"
 */
export function formatCurrency(value: number, currency: string | undefined | null): string {
  if (!currency) {
    return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  const currencyUpper = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[currencyUpper];

  // If we have a custom symbol, use number formatting + symbol
  if (symbol) {
    try {
      const locale = getLocaleForCurrency(currencyUpper);
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
      return `${formatted} ${symbol}`;
    } catch {
      return `${value.toFixed(2)} ${symbol}`;
    }
  }

  // For other currencies, use standard currency formatting
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currencyUpper,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("ru-RU").format(value);
  }
}

/**
 * Format a date string to localized format.
 */
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU");
}

/**
 * Get the currency symbol for a given code.
 * Returns the code itself if no symbol is defined.
 */
export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code;
}

/**
 * Get a short label for displaying a currency in column headers,
 * using the symbol when available.
 */
export function getCurrencyLabel(code: string): string {
  const symbol = CURRENCY_SYMBOLS[code.toUpperCase()];
  return symbol || code;
}
