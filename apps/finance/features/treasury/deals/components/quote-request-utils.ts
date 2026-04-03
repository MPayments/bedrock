type CurrencyOptionItem = {
  code: string;
  id: string;
  label: string;
};

function normalizeDecimalString(value: string) {
  return value.trim().replace(",", ".");
}

export function decimalToMinorString(
  amount: string,
  precision: number,
): string | null {
  const normalized = normalizeDecimalString(amount);

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);

  if (!match) {
    return null;
  }

  const integerPart = match[1] ?? "0";
  const rawFraction = match[2] ?? "";

  if (rawFraction.length > precision) {
    return null;
  }

  const fractionPart = rawFraction.padEnd(precision, "0");
  const combined = `${integerPart}${fractionPart}`;
  const trimmed = combined.replace(/^0+(?=\d)/, "");

  return trimmed.length > 0 ? trimmed : "0";
}

export function decimalRateToFraction(input: string): {
  rateDen: string;
  rateNum: string;
} | null {
  const normalized = normalizeDecimalString(input);

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);

  if (!match) {
    return null;
  }

  const integerPart = match[1] ?? "0";
  const rawFraction = match[2] ?? "";
  const numerator = `${integerPart}${rawFraction}`.replace(/^0+(?=\d)/, "");
  const denominator = rawFraction.length === 0 ? "1" : `1${"0".repeat(rawFraction.length)}`;

  if (!numerator || numerator === "0") {
    return null;
  }

  return {
    rateDen: denominator,
    rateNum: numerator,
  };
}

export function resolveDefaultToCurrency(input: {
  currentValue: string;
  options: CurrencyOptionItem[];
  preferredTargetCurrencyId: string | null;
  sourceCurrencyCode: string;
}) {
  if (input.preferredTargetCurrencyId) {
    const preferredOption = input.options.find(
      (item) =>
        item.id === input.preferredTargetCurrencyId &&
        item.code !== input.sourceCurrencyCode,
    );

    if (preferredOption) {
      return preferredOption.code;
    }
  }

  if (
    input.currentValue &&
    input.options.some((item) => item.code === input.currentValue)
  ) {
    return input.currentValue;
  }

  return (
    input.options.find((item) => item.code !== input.sourceCurrencyCode)?.code ??
    input.options[0]?.code ??
    ""
  );
}

export type { CurrencyOptionItem };
