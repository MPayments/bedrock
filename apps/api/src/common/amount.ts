import {
  minorToAmountString,
  type MoneyFormatOptions,
} from "@bedrock/shared/money";

const MONEY_FIELD_MAP: Record<string, string> = {
  amountMinor: "amount",
  balanceMinor: "balance",
  revenueMinor: "revenue",
  expenseMinor: "expense",
  netMinor: "net",
};

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
