import {
  minorToAmountString,
  mulDivRoundHalfUp,
  parseMinorAmount,
  toMinorAmountString,
} from "@bedrock/shared/money";

export type FinancialLineCalcMethod = "fixed" | "percent";
export type ManualFinancialLineDraftInput =
  | {
      calcMethod: "fixed";
      bucket: string;
      currency: string;
      amount: string;
      memo?: string;
    }
  | {
      calcMethod: "percent";
      bucket: string;
      currency?: string;
      percent: string;
      memo?: string;
    };

export interface ManualFinancialLinePayload {
  id: string;
  bucket: string;
  currency: string;
  amount: string;
  amountMinor: string;
  source: "manual";
  settlementMode: "in_ledger" | "separate_payment_order";
  memo?: string;
  metadata?: Record<string, string>;
  calcMethod?: FinancialLineCalcMethod;
  percentBps?: number;
}

const MAX_PERCENT_BPS = 1_000_000;
const PERCENT_BPS_SCALE = 10_000n;

function resolveSettlementMode(bucket: string) {
  return bucket === "pass_through" ? "separate_payment_order" : "in_ledger";
}

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

  const normalizedFraction = fractionPart.toString().padStart(2, "0").replace(/0+$/, "");
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

  const sign = percentBps < 0 ? -1n : 1n;
  const absoluteBps = BigInt(Math.abs(percentBps));
  const amountMinor = mulDivRoundHalfUp(
    baseAmountMinor,
    absoluteBps,
    PERCENT_BPS_SCALE,
  );
  return sign * amountMinor;
}

export function compileManualFinancialLine(input: {
  line: ManualFinancialLineDraftInput;
  baseAmountMinor: bigint | string;
  baseCurrency: string;
  lineId?: string;
  createId?: () => string;
}): ManualFinancialLinePayload {
  const baseAmountMinor = parseMinorAmount(input.baseAmountMinor);
  if (baseAmountMinor === null || baseAmountMinor <= 0n) {
    throw new Error("base amount must be positive");
  }

  const baseCurrency = input.baseCurrency.trim().toUpperCase();

  const id = input.lineId ?? input.createId?.() ?? `manual:${crypto.randomUUID()}`;

  if (input.line.calcMethod === "fixed") {
    const amountMinor = toMinorAmountString(input.line.amount, input.line.currency);
    if (parseMinorAmount(amountMinor) === 0n) {
      throw new Error("amount must be non-zero");
    }

    return {
      id,
      bucket: input.line.bucket,
      currency: input.line.currency,
      amount: input.line.amount,
      amountMinor,
      source: "manual",
      settlementMode: resolveSettlementMode(input.line.bucket),
      memo: input.line.memo,
      metadata: undefined,
      calcMethod: "fixed",
    };
  }

  const percentBps = parseSignedPercentToBps(input.line.percent);
  if (baseCurrency.length === 0) {
    throw new Error("percent-based financial lines require a resolved base currency");
  }
  const resolvedCurrency = input.line.currency?.trim().toUpperCase() ?? "";
  if (resolvedCurrency.length > 0 && resolvedCurrency !== baseCurrency) {
    throw new Error(
      `percent-based financial line currency must match base currency ${baseCurrency}`,
    );
  }

  const amountMinor = calculatePercentAmountMinor(baseAmountMinor, percentBps);
  if (amountMinor === 0n) {
    throw new Error("percent-based financial line must not resolve to zero");
  }

  return {
    id,
    bucket: input.line.bucket,
    currency: baseCurrency,
    amount: minorToAmountString(amountMinor, { currency: baseCurrency }),
    amountMinor: amountMinor.toString(),
    source: "manual",
    settlementMode: resolveSettlementMode(input.line.bucket),
    memo: input.line.memo,
    metadata: undefined,
    calcMethod: "percent",
    percentBps,
  };
}
