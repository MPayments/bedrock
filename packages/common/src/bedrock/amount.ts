interface MoneyFormatOptions {
  currency?: string | null | undefined;
  precision?: number | null | undefined;
}

const MONEY_FIELD_MAP: Record<string, string> = {
  amountMinor: "amount",
  balanceMinor: "balance",
  revenueMinor: "revenue",
  expenseMinor: "expense",
  netMinor: "net",
};

function resolveCurrencyPrecision(
  currencyCode: string | null | undefined,
): number {
  const normalized = currencyCode?.trim().toUpperCase() ?? "";
  if (normalized.length === 0) {
    return 2;
  }

  try {
    const options = new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalized,
    }).resolvedOptions();
    return Math.max(0, Math.trunc(options.maximumFractionDigits ?? 2));
  } catch {
    return 2;
  }
}

function resolvePrecision(options: MoneyFormatOptions): number {
  if (
    typeof options.precision === "number" &&
    Number.isFinite(options.precision)
  ) {
    return Math.max(0, Math.trunc(options.precision));
  }

  return resolveCurrencyPrecision(options.currency);
}

function parseMinorAmount(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value)
  ) {
    return BigInt(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (/^-?\d+$/u.test(normalized)) {
      try {
        return BigInt(normalized);
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function minorToAmountString(
  value: unknown,
  options: MoneyFormatOptions = {},
): string {
  const minorAmount = parseMinorAmount(value);
  if (minorAmount === null) {
    if (typeof value === "string") {
      return value;
    }
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  }

  const precision = resolvePrecision(options);
  const isNegative = minorAmount < 0n;
  const absoluteMinor = isNegative ? -minorAmount : minorAmount;
  const sign = isNegative ? "-" : "";

  if (precision === 0) {
    return `${sign}${absoluteMinor.toString()}`;
  }

  const base = absoluteMinor.toString().padStart(precision + 1, "0");
  const integerPart = base.slice(0, -precision);
  const fractionPart = base.slice(-precision).replace(/0+$/u, "");

  if (fractionPart.length === 0) {
    return `${sign}${integerPart}`;
  }

  return `${sign}${integerPart}.${fractionPart}`;
}

export function normalizeMoneyFields(
  value: unknown,
  context: MoneyFormatOptions = {},
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMoneyFields(item, context));
  }

  if (!value || typeof value !== "object" || value instanceof Date) {
    return value;
  }

  const input = value as Record<string, unknown>;
  const scopedCurrency =
    typeof input.currency === "string" ? input.currency : context.currency;
  const scopedPrecision =
    typeof input.currencyPrecision === "number"
      ? input.currencyPrecision
      : typeof input.precision === "number"
        ? input.precision
        : context.precision;

  const scopedContext: MoneyFormatOptions = {
    currency: scopedCurrency,
    precision: scopedPrecision,
  };

  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(input)) {
    const targetKey = MONEY_FIELD_MAP[key];
    if (targetKey) {
      output[targetKey] = minorToAmountString(item, scopedContext);
      continue;
    }

    output[key] = normalizeMoneyFields(item, scopedContext);
  }

  return output;
}
