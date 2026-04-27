import { BPS_SCALE, mulDivRoundHalfUp } from "./math";

export const MAX_PERCENT_BPS = 1_000_000;
export const PERCENT_BPS_SCALE = BPS_SCALE;

function isAsciiDigits(value: string): boolean {
  for (const character of value) {
    if (character < "0" || character > "9") {
      return false;
    }
  }

  return value.length > 0;
}

export function parseSignedPercentToBps(percent: string): number {
  const normalized = percent.trim().replace(",", ".");
  if (normalized.length === 0) {
    throw new Error("percent must be a number, e.g. 1.25");
  }

  const signCharacter = normalized[0];
  const sign = signCharacter === "-" ? -1 : 1;
  const unsigned =
    signCharacter === "-" || signCharacter === "+"
      ? normalized.slice(1)
      : normalized;

  if (unsigned.length === 0) {
    throw new Error("percent must be a number, e.g. 1.25");
  }

  const dotIndex = unsigned.indexOf(".");
  const hasDot = dotIndex !== -1;
  const hasMultipleDots = hasDot && unsigned.indexOf(".", dotIndex + 1) !== -1;
  if (hasMultipleDots) {
    throw new Error("percent must be a number, e.g. 1.25");
  }

  const integerPart = hasDot ? unsigned.slice(0, dotIndex) : unsigned;
  const fractionSource = hasDot ? unsigned.slice(dotIndex + 1) : "";
  if (
    !isAsciiDigits(integerPart) ||
    fractionSource.length > 2 ||
    (fractionSource.length > 0 && !isAsciiDigits(fractionSource))
  ) {
    throw new Error("percent must be a number, e.g. 1.25");
  }

  const fractionPart = fractionSource.padEnd(2, "0");
  const bps = Number(integerPart) * 100 + Number(fractionPart);

  if (!Number.isInteger(bps) || bps > MAX_PERCENT_BPS) {
    throw new Error("percent is too large");
  }

  return sign * bps;
}

export function formatPercentFromBps(bps: number): string {
  if (!Number.isInteger(bps)) {
    throw new Error("percent bps must be an integer");
  }

  const sign = bps < 0 ? "-" : "";
  const absoluteBps = Math.abs(bps);
  const integerPart = Math.trunc(absoluteBps / 100);
  const fractionPart = absoluteBps % 100;

  if (fractionPart === 0) {
    return `${sign}${integerPart}`;
  }

  const normalizedFraction = fractionPart
    .toString()
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${sign}${integerPart}.${normalizedFraction}`;
}

export function calculatePercentAmountMinor(
  baseAmountMinor: bigint,
  percentBps: number,
): bigint {
  if (baseAmountMinor <= 0n) {
    throw new Error("baseAmountMinor must be positive");
  }

  if (!Number.isInteger(percentBps)) {
    throw new Error("percentBps must be an integer");
  }

  return calculateBpsAmountMinorHalfUp(baseAmountMinor, BigInt(percentBps));
}

export function calculateBpsAmountMinorHalfUp(
  amountMinor: bigint,
  bps: bigint,
): bigint {
  if (amountMinor === 0n || bps === 0n) {
    return 0n;
  }

  return mulDivRoundHalfUp(amountMinor, bps, PERCENT_BPS_SCALE);
}
