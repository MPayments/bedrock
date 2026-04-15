import {
  formatDecimalString,
  formatFractionDecimal,
} from "@bedrock/shared/money";

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
  return formatFractionDecimal(numerator, denominator, {
    scale,
    trimTrailingZeros: true,
  });
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

  const normalized =
    typeof value === "number"
      ? new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
      : (() => {
        try {
          return formatDecimalString(value, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } catch {
          return null;
        }
      })();

  if (normalized === null) {
    return "—";
  }

  try {
    const parts = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency ?? "RUB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(1);
    const currencyPart = parts.find((part) => part.type === "currency")?.value;

    return currencyPart ? `${normalized} ${currencyPart}` : normalized;
  } catch {
    return normalized;
  }
}

export function formatMinorAmountWithCurrency(
  amountMinor: string | null,
  currencyCode: string | null,
  precision = 2,
) {
  if (amountMinor === null || !currencyCode) {
    return "—";
  }

  return `${formatDecimalString(minorToDecimalString(amountMinor, precision), {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })} ${currencyCode}`;
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
