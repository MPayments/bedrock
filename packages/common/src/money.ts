import { z } from "zod";

export interface MoneyFormatOptions {
  currency?: string | null | undefined;
  precision?: number | null | undefined;
}

export interface NormalizeMajorAmountInputOptions {
  invalidNumberMessage?: string;
  tooManyFractionDigitsMessage?: (input: {
    currency: string;
    precision: number;
  }) => string;
}

function isDigits(value: string): boolean {
  if (value.length === 0) {
    return false;
  }

  for (const char of value) {
    if (char < "0" || char > "9") {
      return false;
    }
  }

  return true;
}

function parseAmountParts(input: string): {
  signRaw: "" | "-";
  integerRaw: string;
  fractionRaw: string;
} | null {
  const signRaw = input.startsWith("-") ? "-" : "";
  const unsigned = signRaw ? input.slice(1) : input;
  const dotIndex = unsigned.indexOf(".");
  const hasDot = dotIndex !== -1;

  if (!hasDot) {
    if (!isDigits(unsigned)) {
      return null;
    }

    return {
      signRaw,
      integerRaw: unsigned,
      fractionRaw: "",
    };
  }

  if (unsigned.indexOf(".", dotIndex + 1) !== -1) {
    return null;
  }

  const integerRaw = unsigned.slice(0, dotIndex);
  const fractionRaw = unsigned.slice(dotIndex + 1);
  if (!isDigits(integerRaw) || !isDigits(fractionRaw)) {
    return null;
  }

  return {
    signRaw,
    integerRaw,
    fractionRaw,
  };
}

function defaultTooManyFractionDigitsMessage(input: {
  currency: string;
  precision: number;
}) {
  return `amount has too many fraction digits for ${
    input.currency.length > 0 ? input.currency : "selected currency"
  }: max ${input.precision}`;
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

function readAmountInputValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return "";
}

export function normalizeAmountValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("amount must be a finite number");
    }
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  throw new Error("amount must be a string, number, or bigint");
}

export function parseMinorAmount(value: unknown): bigint | null {
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
    if (/^-?\d+$/.test(normalized)) {
      try {
        return BigInt(normalized);
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function resolveCurrencyPrecision(currencyCode: unknown): number {
  if (typeof currencyCode !== "string") {
    return 2;
  }

  const normalized = currencyCode.trim().toUpperCase();
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

export function toMinorAmountString(
  amountValue: unknown,
  currencyCode: unknown,
  options?: { requirePositive?: boolean },
): string {
  const normalized = normalizeAmountValue(amountValue).replace(",", ".");
  const parsed = parseAmountParts(normalized);
  if (!parsed) {
    throw new Error("amount must be a number, e.g. 1000.50");
  }

  const { signRaw, integerRaw, fractionRaw } = parsed;
  const precision = resolveCurrencyPrecision(currencyCode);

  if (fractionRaw.length > precision) {
    const currency =
      typeof currencyCode === "string" ? currencyCode.trim().toUpperCase() : "";
    throw new Error(
      defaultTooManyFractionDigitsMessage({ currency, precision }),
    );
  }

  const fractionPart = fractionRaw.padEnd(precision, "0");
  const normalizedInteger = integerRaw.replace(/^0+(?=\d)/, "");
  const minorDigits = `${normalizedInteger}${fractionPart}`.replace(
    /^0+(?=\d)/,
    "",
  );
  let minorAmount = BigInt(minorDigits.length > 0 ? minorDigits : "0");

  if (signRaw === "-" && minorAmount !== 0n) {
    minorAmount = -minorAmount;
  }

  if (options?.requirePositive && minorAmount <= 0n) {
    throw new Error("amount must be positive");
  }

  return minorAmount.toString();
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
  const fractionPart = base.slice(-precision).replace(/0+$/, "");

  if (fractionPart.length === 0) {
    return `${sign}${integerPart}`;
  }

  return `${sign}${integerPart}.${fractionPart}`;
}

export function normalizeMajorAmountInput(
  amountMajor: unknown,
  currencyCode: unknown,
  options?: NormalizeMajorAmountInputOptions,
): string {
  const normalizedMajor = readAmountInputValue(amountMajor)
    .trim()
    .replace(",", ".");
  if (normalizedMajor.length === 0) {
    return "";
  }

  const parsed = parseAmountParts(normalizedMajor);
  if (!parsed) {
    throw new Error(
      options?.invalidNumberMessage ?? "amount must be a number, e.g. 1000.50",
    );
  }

  const { signRaw, integerRaw, fractionRaw } = parsed;
  const precision = resolveCurrencyPrecision(currencyCode);
  if (fractionRaw.length > precision) {
    const currency =
      typeof currencyCode === "string" ? currencyCode.trim().toUpperCase() : "";
    const buildMessage =
      options?.tooManyFractionDigitsMessage ??
      defaultTooManyFractionDigitsMessage;
    throw new Error(buildMessage({ currency, precision }));
  }

  const normalizedInteger = integerRaw.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fractionRaw.replace(/0+$/, "");
  const isZero =
    /^0+$/.test(normalizedInteger.length > 0 ? normalizedInteger : "0") &&
    normalizedFraction.length === 0;
  const sign = signRaw === "-" && !isZero ? "-" : "";

  if (normalizedFraction.length === 0) {
    return `${sign}${normalizedInteger.length > 0 ? normalizedInteger : "0"}`;
  }

  return `${sign}${normalizedInteger}.${normalizedFraction}`;
}

export const amountValueSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((value, ctx) => {
    const normalized = normalizeAmountValue(value).replace(",", ".");
    const parsed = parseAmountParts(normalized);
    if (!parsed) {
      ctx.addIssue({
        code: "custom",
        message: "amount must be a number, e.g. 1000.50",
      });
      return z.NEVER;
    }

    const { signRaw, integerRaw, fractionRaw } = parsed;
    const normalizedInteger = integerRaw.replace(/^0+(?=\d)/, "");
    const normalizedFraction = fractionRaw.replace(/0+$/, "");
    const isZero =
      /^0+$/.test(normalizedInteger.length > 0 ? normalizedInteger : "0") &&
      normalizedFraction.length === 0;

    if (normalizedFraction.length === 0) {
      return isZero ? "0" : `${signRaw}${normalizedInteger}`;
    }

    return `${signRaw}${normalizedInteger}.${normalizedFraction}`;
  });

export const amountMinorSchema = z
  .union([z.string(), z.number().int(), z.bigint()])
  .transform((value, ctx) => {
    const parsed = parseMinorAmount(value);
    if (parsed === null) {
      ctx.addIssue({
        code: "custom",
        message: "amountMinor must be an integer in minor units",
      });
      return z.NEVER;
    }

    if (parsed <= 0n) {
      ctx.addIssue({
        code: "custom",
        message: "amountMinor must be positive",
      });
      return z.NEVER;
    }

    return parsed.toString();
  });

export const signedMinorAmountSchema = z
  .union([z.string(), z.number().int(), z.bigint()])
  .transform((value, ctx) => {
    const parsed = parseMinorAmount(value);
    if (parsed === null) {
      ctx.addIssue({
        code: "custom",
        message: "amountMinor must be an integer in minor units",
      });
      return z.NEVER;
    }

    if (parsed === 0n) {
      ctx.addIssue({
        code: "custom",
        message: "amountMinor must be non-zero",
      });
      return z.NEVER;
    }

    return parsed;
  });
