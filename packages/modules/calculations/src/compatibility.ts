import type {
  Calculation,
  CalculationDetails,
} from "./application/contracts/dto";

export interface CalculationCompatibilityCurrency {
  code: string;
  id: string;
  precision: number;
}

export interface CompatibilityCalculation {
  additionalExpenses: string;
  additionalExpensesCurrencyCode: string | null;
  additionalExpensesInBase: string;
  baseCurrencyCode: string;
  calculationTimestamp: string;
  createdAt: string;
  currencyCode: string;
  dealId: string | null;
  feeAmount: string;
  feeAmountInBase: string;
  feePercentage: string;
  fxQuoteId: string | null;
  id: string;
  originalAmount: string;
  rate: string;
  rateSource: string;
  sentToClient: number;
  status: "active" | "archived";
  totalAmount: string;
  totalInBase: string;
  totalWithExpensesInBase: string;
}

export function minorToDecimalString(
  amountMinor: bigint | string,
  precision: number,
): string {
  const value = typeof amountMinor === "string" ? BigInt(amountMinor) : amountMinor;
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

export function rationalToDecimalString(
  numerator: bigint | string,
  denominator: bigint | string,
  scale = 6,
): string {
  const num = typeof numerator === "string" ? BigInt(numerator) : numerator;
  const den = typeof denominator === "string" ? BigInt(denominator) : denominator;

  if (den === 0n) {
    throw new Error("Cannot serialize rate with zero denominator");
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

  if (trimmedFraction.length === 0) {
    return `${prefix}${integerPart.toString()}`;
  }

  return `${prefix}${integerPart.toString()}.${trimmedFraction}`;
}

export function feeBpsToPercentString(feeBps: bigint | string): string {
  return minorToDecimalString(feeBps, 2);
}

function serializeCompatibilityRateSource(rateSource: string): string {
  return rateSource === "cbr" ? "cbru" : rateSource;
}

type CompatibleCalculationShape = Calculation | CalculationDetails;

export function serializeCompatibilityCalculation(input: {
  calculation: CompatibleCalculationShape;
  currencies: Map<string, CalculationCompatibilityCurrency>;
  dealId: string | null;
  sentToClient?: number | null;
}): CompatibilityCalculation {
  const snapshot = input.calculation.currentSnapshot;
  const calculationCurrency = input.currencies.get(snapshot.calculationCurrencyId);
  const baseCurrency = input.currencies.get(snapshot.baseCurrencyId);
  const additionalExpensesCurrency = snapshot.additionalExpensesCurrencyId
    ? input.currencies.get(snapshot.additionalExpensesCurrencyId) ?? null
    : null;

  if (!calculationCurrency || !baseCurrency) {
    throw new Error("Missing currency metadata for compatibility serialization");
  }

  return {
    id: input.calculation.id,
    dealId: input.dealId,
    currencyCode: calculationCurrency.code,
    originalAmount: minorToDecimalString(
      snapshot.originalAmountMinor,
      calculationCurrency.precision,
    ),
    feePercentage: feeBpsToPercentString(snapshot.feeBps),
    feeAmount: minorToDecimalString(
      snapshot.feeAmountMinor,
      calculationCurrency.precision,
    ),
    totalAmount: minorToDecimalString(
      snapshot.totalAmountMinor,
      calculationCurrency.precision,
    ),
    rateSource: serializeCompatibilityRateSource(snapshot.rateSource),
    rate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    additionalExpensesCurrencyCode: additionalExpensesCurrency?.code ?? null,
    additionalExpenses: minorToDecimalString(
      snapshot.additionalExpensesAmountMinor,
      additionalExpensesCurrency?.precision ?? baseCurrency.precision,
    ),
    baseCurrencyCode: baseCurrency.code,
    feeAmountInBase: minorToDecimalString(
      snapshot.feeAmountInBaseMinor,
      baseCurrency.precision,
    ),
    totalInBase: minorToDecimalString(
      snapshot.totalInBaseMinor,
      baseCurrency.precision,
    ),
    additionalExpensesInBase: minorToDecimalString(
      snapshot.additionalExpensesInBaseMinor,
      baseCurrency.precision,
    ),
    totalWithExpensesInBase: minorToDecimalString(
      snapshot.totalWithExpensesInBaseMinor,
      baseCurrency.precision,
    ),
    calculationTimestamp: snapshot.calculationTimestamp.toISOString(),
    sentToClient: input.sentToClient ?? 0,
    status: input.calculation.isActive ? "active" : "archived",
    fxQuoteId: snapshot.fxQuoteId,
    createdAt: input.calculation.createdAt.toISOString(),
  };
}
