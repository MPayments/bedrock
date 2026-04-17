import { getKnownCurrency } from "@bedrock/currencies/catalog";
import { formatFractionDecimal } from "@bedrock/shared/money";

import { SOURCE_LABELS } from "./constants";

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function currencySymbol(code: string): string {
  const knownCurrency = getKnownCurrency(code);
  if (knownCurrency?.symbol) {
    return knownCurrency.symbol;
  }

  try {
    const currencyPart = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(1)
      .find((part) => part.type === "currency");

    return currencyPart?.value ?? code;
  } catch {
    return code;
  }
}

export function computeDecimalRate(rateNum: string, rateDen: string): number {
  return Number(
    formatFractionDecimal(rateNum, rateDen, {
      scale: 12,
      trimTrailingZeros: false,
    }),
  );
}

export function getDecimalPlaces(value: number, minDecimals: number): number {
  if (value === 0) return minDecimals;
  const abs = Math.abs(value);
  if (abs >= 1) return minDecimals;
  const firstSigDigit = -Math.floor(Math.log10(abs));
  return Math.max(minDecimals, firstSigDigit + 2);
}

export function formatRate(rateNum: string, rateDen: string): string {
  return formatFractionDecimal(rateNum, rateDen, {
    scale: 6,
    trimTrailingZeros: false,
  });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

export function formatChange(value: number | null): {
  text: string;
  className: string;
} {
  if (value === null) return { text: "—", className: "text-muted-foreground" };
  const decimals = getDecimalPlaces(value, 4);
  if (value > 0)
    return {
      text: `+${value.toFixed(decimals)}`,
      className: "text-green-600",
    };
  if (value < 0)
    return { text: value.toFixed(decimals), className: "text-red-600" };
  return { text: (0).toFixed(decimals), className: "text-muted-foreground" };
}

export function formatChangePercent(value: number | null): {
  text: string;
  className: string;
} {
  if (value === null) return { text: "—", className: "text-muted-foreground" };
  if (value > 0)
    return { text: `+${value.toFixed(2)}%`, className: "text-green-600" };
  if (value < 0)
    return { text: `${value.toFixed(2)}%`, className: "text-red-600" };
  return { text: "0.00%", className: "text-muted-foreground" };
}
