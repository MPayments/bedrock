import {
  calculatePercentAmountMinor,
  formatPercentFromBps,
  minorToAmountString,
  parseMinorAmount,
  parseSignedPercentToBps,
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

export {
  calculatePercentAmountMinor,
  formatPercentFromBps,
  parseSignedPercentToBps,
};

function resolveSettlementMode(bucket: string) {
  return bucket === "pass_through" ? "separate_payment_order" : "in_ledger";
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

  const id =
    input.lineId ?? input.createId?.() ?? `manual:${crypto.randomUUID()}`;

  if (input.line.calcMethod === "fixed") {
    const amountMinor = toMinorAmountString(
      input.line.amount,
      input.line.currency,
    );
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
    throw new Error(
      "percent-based financial lines require a resolved base currency",
    );
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
