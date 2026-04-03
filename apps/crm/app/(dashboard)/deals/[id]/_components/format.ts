export function minorToDecimalString(amountMinor: string, precision: number) {
  const value = BigInt(amountMinor);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const digits = absolute.toString();

  if (precision === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(precision + 1, "0");
  const integerPart = padded.slice(0, padded.length - precision);
  const fractionPart = padded.slice(padded.length - precision);

  return `${negative ? "-" : ""}${integerPart}.${fractionPart}`;
}

export function decimalToMinorString(
  amount: string,
  precision: number,
): string | null {
  const normalized = amount.trim().replace(",", ".");
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
  if (!/^\d+$/.test(combined)) {
    return null;
  }

  const trimmed = combined.replace(/^0+(?=\d)/, "");
  return trimmed.length > 0 ? trimmed : "0";
}

export function formatDateTimeInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function rationalToDecimalString(
  numerator: string,
  denominator: string,
  scale = 6,
) {
  const num = BigInt(numerator);
  const den = BigInt(denominator);

  if (den === 0n) {
    throw new Error("Cannot format rate with zero denominator");
  }

  const negative = (num < 0n) !== (den < 0n);
  const absoluteNum = num < 0n ? -num : num;
  const absoluteDen = den < 0n ? -den : den;
  const integerPart = absoluteNum / absoluteDen;
  let remainder = absoluteNum % absoluteDen;
  let fraction = "";

  for (let index = 0; index < scale; index += 1) {
    remainder *= 10n;
    fraction += (remainder / absoluteDen).toString();
    remainder %= absoluteDen;
  }

  const trimmedFraction = fraction.replace(/0+$/, "");
  const prefix = negative ? "-" : "";
  return trimmedFraction ? `${prefix}${integerPart}.${trimmedFraction}` : `${prefix}${integerPart}`;
}

export function feeBpsToPercentString(feeBps: string) {
  return minorToDecimalString(feeBps, 2);
}

export function formatCurrency(
  value: string | number | null,
  currency?: string | null,
) {
  if (value === null) {
    return "—";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency ?? "RUB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  }
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateShort(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
