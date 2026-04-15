import { formatFractionDecimal } from "@bedrock/shared/money";
import type { CalculationDocumentData } from "@bedrock/workflow-document-generation";

import type { CalculationDetails } from "@bedrock/calculations/contracts";
import type { AppContext } from "../../context";

interface CalculationCurrencyMetadata {
  code: string;
  id: string;
  precision: number;
}

function minorToDecimalString(amountMinor: bigint | string, precision: number) {
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

function feeBpsToPercentString(feeBps: bigint | string) {
  return minorToDecimalString(feeBps, 2);
}

function rationalToDecimalString(
  numerator: bigint | string,
  denominator: bigint | string,
  scale = 6,
) {
  return formatFractionDecimal(numerator, denominator, {
    scale,
    trimTrailingZeros: true,
  });
}

function serializeRateSource(rateSource: string) {
  return rateSource === "cbr" ? "cbru" : rateSource;
}

export async function serializeCalculationDocumentData(input: {
  calculation: CalculationDetails;
  currenciesService: Pick<AppContext["currenciesService"], "findById">;
}): Promise<CalculationDocumentData> {
  const snapshot = input.calculation.currentSnapshot;
  const currencyIds = Array.from(
    new Set(
      [
        snapshot.calculationCurrencyId,
        snapshot.baseCurrencyId,
        snapshot.additionalExpensesCurrencyId,
        snapshot.fixedFeeCurrencyId,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const currencies = new Map<string, CalculationCurrencyMetadata>(
    await Promise.all(
      currencyIds.map(async (currencyId) => {
        const currency = await input.currenciesService.findById(currencyId);
        return [
          currencyId,
          {
            code: currency.code,
            id: currency.id,
            precision: currency.precision,
          },
        ] as const;
      }),
    ),
  );
  const calculationCurrency = currencies.get(snapshot.calculationCurrencyId);
  const baseCurrency = currencies.get(snapshot.baseCurrencyId);
  const additionalExpensesCurrency = snapshot.additionalExpensesCurrencyId
    ? currencies.get(snapshot.additionalExpensesCurrencyId) ?? null
    : null;

  if (!calculationCurrency || !baseCurrency) {
    throw new Error("Missing currency metadata for calculation export");
  }

  return {
    id: input.calculation.id,
    currencyCode: calculationCurrency.code,
    originalAmount: minorToDecimalString(
      snapshot.originalAmountMinor,
      calculationCurrency.precision,
    ),
    agreementFeePercentage: feeBpsToPercentString(snapshot.agreementFeeBps),
    agreementFeeAmount: minorToDecimalString(
      snapshot.agreementFeeAmountMinor,
      calculationCurrency.precision,
    ),
    quoteMarkupPercentage: feeBpsToPercentString(snapshot.quoteMarkupBps),
    quoteMarkupAmount: minorToDecimalString(
      snapshot.quoteMarkupAmountMinor,
      calculationCurrency.precision,
    ),
    totalFeePercentage: feeBpsToPercentString(snapshot.totalFeeBps),
    totalFeeAmount: minorToDecimalString(
      snapshot.totalFeeAmountMinor,
      calculationCurrency.precision,
    ),
    totalAmount: minorToDecimalString(
      snapshot.totalAmountMinor,
      calculationCurrency.precision,
    ),
    finalRate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    rateSource: serializeRateSource(snapshot.rateSource),
    rate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    additionalExpenses: minorToDecimalString(
      snapshot.additionalExpensesAmountMinor,
      additionalExpensesCurrency?.precision ?? baseCurrency.precision,
    ),
    baseCurrencyCode: baseCurrency.code,
    totalFeeAmountInBase: minorToDecimalString(
      snapshot.totalFeeAmountInBaseMinor,
      baseCurrency.precision,
    ),
    fixedFeeAmount: snapshot.fixedFeeCurrencyId
      ? minorToDecimalString(
          snapshot.fixedFeeAmountMinor,
          currencies.get(snapshot.fixedFeeCurrencyId)?.precision ??
            baseCurrency.precision,
        )
      : minorToDecimalString(snapshot.fixedFeeAmountMinor, baseCurrency.precision),
    fixedFeeCurrencyCode: snapshot.fixedFeeCurrencyId
      ? (currencies.get(snapshot.fixedFeeCurrencyId)?.code ?? null)
      : null,
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
  };
}
