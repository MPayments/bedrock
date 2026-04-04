export const BPS_SCALE = 10000n;
export const DAY_IN_SECONDS = 86400;
export const FIVE_MIN_IN_SECONDS = 300;

export interface Fraction {
  num: bigint;
  den: bigint;
}

export interface ParseDecimalToFractionOptions {
  allowScientific?: boolean;
}

export interface RateFraction {
  rateNum: bigint;
  rateDen: bigint;
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;

  while (y !== 0n) {
    const rest = x % y;
    x = y;
    y = rest;
  }

  return x;
}

export function mulDivFloor(a: bigint, num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new Error("rateDen must be > 0");
  return (a * num) / den;
}

export function mulDivCeil(a: bigint, num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new Error("rateDen must be > 0");
  return ((a * num) + den - 1n) / den;
}

// Monetary amounts round to the nearest minor unit; ties round away from zero.
export function mulDivRoundHalfUp(
  a: bigint,
  num: bigint,
  den: bigint,
): bigint {
  if (den <= 0n) throw new Error("rateDen must be > 0");

  const product = a * num;
  if (product === 0n) {
    return 0n;
  }

  const negative = product < 0n;
  const absoluteProduct = negative ? -product : product;
  const rounded = (absoluteProduct + den / 2n) / den;

  return negative ? -rounded : rounded;
}

export function formatFractionDecimal(
  numerator: bigint | string,
  denominator: bigint | string,
  options: {
    scale?: number;
    trimTrailingZeros?: boolean;
  } = {},
): string {
  const scale = options.scale ?? 6;
  const trimTrailingZeros = options.trimTrailingZeros ?? true;
  const num = typeof numerator === "string" ? BigInt(numerator) : numerator;
  const den = typeof denominator === "string" ? BigInt(denominator) : denominator;

  if (den === 0n) {
    throw new Error("rateDen must be > 0");
  }

  if (scale < 0) {
    throw new Error("scale must be non-negative");
  }

  const negative = (num < 0n) !== (den < 0n);
  const absoluteNum = num < 0n ? -num : num;
  const absoluteDen = den < 0n ? -den : den;

  if (scale === 0) {
    const roundedInteger = (absoluteNum + absoluteDen / 2n) / absoluteDen;
    return `${negative ? "-" : ""}${roundedInteger.toString()}`;
  }

  const scaleFactor = 10n ** BigInt(scale);
  const roundedScaled =
    (absoluteNum * scaleFactor + absoluteDen / 2n) / absoluteDen;
  const integerPart = roundedScaled / scaleFactor;
  const fractionalPart = roundedScaled % scaleFactor;
  const rawFraction = fractionalPart.toString().padStart(scale, "0");
  const fraction = trimTrailingZeros ? rawFraction.replace(/0+$/, "") : rawFraction;
  const prefix = negative ? "-" : "";

  if (fraction.length === 0) {
    return `${prefix}${integerPart.toString()}`;
  }

  return `${prefix}${integerPart.toString()}.${fraction}`;
}

export function effectiveRateFromAmounts(
  fromAmountMinor: bigint,
  toAmountMinor: bigint,
): RateFraction {
  const d = gcd(toAmountMinor, fromAmountMinor);
  return {
    rateNum: toAmountMinor / d,
    rateDen: fromAmountMinor / d,
  };
}

export function parseDecimalToFraction(
  input: string,
  options: ParseDecimalToFractionOptions = {},
): Fraction {
  const allowScientific = options.allowScientific ?? true;
  const normalized = normalizeNumberString(input)
    .replace(",", ".")
    .toUpperCase();
  if (!normalized.length) {
    throw new Error(`invalid decimal number: ${input}`);
  }

  let mantissa = normalized;
  let exponent = 0;

  const eIndex = normalized.indexOf("E");
  if (eIndex !== -1) {
    if (!allowScientific) {
      throw new Error(`invalid decimal number: ${input}`);
    }
    if (
      eIndex === 0 ||
      eIndex === normalized.length - 1 ||
      normalized.indexOf("E", eIndex + 1) !== -1
    ) {
      throw new Error(`invalid decimal number: ${input}`);
    }

    mantissa = normalized.slice(0, eIndex);
    const exponentRaw = normalized.slice(eIndex + 1);
    if (!isSignedDigits(exponentRaw)) {
      throw new Error(`invalid decimal number: ${input}`);
    }

    exponent = Number(exponentRaw);
    if (!Number.isInteger(exponent)) {
      throw new Error(`invalid decimal number: ${input}`);
    }
  }

  const parts = mantissa.split(".");
  if (parts.length > 2) {
    throw new Error(`invalid decimal number: ${input}`);
  }

  const intPart = parts[0] ?? "";
  const fracPart = parts[1] ?? "";

  if (
    !intPart.length ||
    !isDigits(intPart) ||
    (fracPart.length > 0 && !isDigits(fracPart))
  ) {
    throw new Error(`invalid decimal number: ${input}`);
  }
  if (parts.length === 2 && fracPart.length === 0) {
    throw new Error(`invalid decimal number: ${input}`);
  }

  let digits = intPart + fracPart;
  let scale = fracPart.length - exponent;
  if (scale < 0) {
    digits += "0".repeat(-scale);
    scale = 0;
  }

  const num = BigInt(digits);
  if (num <= 0n) {
    throw new Error(`decimal must be positive: ${input}`);
  }

  const den = 10n ** BigInt(scale);
  return reduceFraction(num, den);
}

export function parsePositiveInt(input: string): bigint | null {
  const normalized = normalizeNumberString(input);
  if (!isDigits(normalized)) return null;

  const value = BigInt(normalized);
  return value > 0n ? value : null;
}

export function reduceFraction(num: bigint, den: bigint): Fraction {
  if (num <= 0n || den <= 0n) {
    throw new Error(`fraction must be positive: ${num}/${den}`);
  }

  const divisor = gcd(num, den);
  return {
    num: num / divisor,
    den: den / divisor,
  };
}

function normalizeNumberString(input: string): string {
  let result = "";

  for (const char of input) {
    if (char === "\u00a0") continue;
    if (char.trim() === "") continue;
    result += char;
  }

  return result.trim();
}

function isDigits(input: string): boolean {
  if (!input.length) return false;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }

  return true;
}

function isSignedDigits(input: string): boolean {
  if (!input.length) return false;

  let start = 0;
  const first = input[0];
  if (first === "+" || first === "-") {
    if (input.length === 1) return false;
    start = 1;
  }

  for (let i = start; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }

  return true;
}
