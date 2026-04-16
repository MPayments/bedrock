import { minorToAmountString, toMinorAmountString } from "@bedrock/shared/money";
import { mulDivRoundHalfUp } from "@bedrock/shared/money/math";

export type PaymentRouteCurrencyOption = {
  code: string;
  id: string;
  label: string;
  name: string;
  precision: number;
};

export function formatCurrencyMinorAmount(
  amountMinor: string | number | bigint,
  currency: PaymentRouteCurrencyOption | null | undefined,
) {
  if (!currency) {
    return String(amountMinor);
  }

  return `${minorToAmountString(amountMinor, {
    precision: currency.precision,
  })} ${currency.code}`;
}

export function formatCurrencyRatio(input: {
  amountInMinor: string;
  amountOutMinor: string;
  currencyIn: PaymentRouteCurrencyOption | null | undefined;
  currencyOut: PaymentRouteCurrencyOption | null | undefined;
}) {
  if (!input.currencyIn || !input.currencyOut) {
    return null;
  }

  try {
    const ratio = formatExactCurrencyRatio({
      amountBaseMinor: input.amountInMinor,
      amountQuoteMinor: input.amountOutMinor,
      baseCurrency: input.currencyIn,
      quoteCurrency: input.currencyOut,
    });

    if (!ratio) {
      return null;
    }

    return `1 ${input.currencyIn.code} ~= ${ratio} ${input.currencyOut.code}`;
  } catch {
    return null;
  }
}

function formatScaledDecimal(scaledValue: bigint, fractionDigits: number) {
  const negative = scaledValue < 0n;
  const absoluteValue = negative ? -scaledValue : scaledValue;
  const scale = 10n ** BigInt(fractionDigits);
  const whole = absoluteValue / scale;
  const fraction = absoluteValue % scale;

  return `${negative ? "-" : ""}${whole.toString()}.${fraction
    .toString()
    .padStart(fractionDigits, "0")}`;
}

export function formatExactCurrencyRatio(input: {
  amountBaseMinor: string | bigint;
  amountQuoteMinor: string | bigint;
  baseCurrency: PaymentRouteCurrencyOption | null | undefined;
  fractionDigits?: number;
  quoteCurrency: PaymentRouteCurrencyOption | null | undefined;
}) {
  const fractionDigits = input.fractionDigits ?? 6;

  if (!input.baseCurrency || !input.quoteCurrency) {
    return null;
  }

  const baseMinor = BigInt(input.amountBaseMinor);
  const quoteMinor = BigInt(input.amountQuoteMinor);

  if (baseMinor <= 0n || quoteMinor < 0n) {
    return null;
  }

  const numerator =
    quoteMinor *
    10n ** BigInt(input.baseCurrency.precision) *
    10n ** BigInt(fractionDigits);
  const denominator =
    baseMinor * 10n ** BigInt(input.quoteCurrency.precision);

  if (denominator <= 0n) {
    return null;
  }

  const scaledRatio = mulDivRoundHalfUp(numerator, 1n, denominator);

  return formatScaledDecimal(scaledRatio, fractionDigits);
}

export function getPaymentRouteRateLines(input: {
  amountInMinor: string;
  cleanAmountOutMinor: string;
  costInclusiveAmountInMinor?: string | null;
  effectiveAmountOutMinor: string;
  currencyIn: PaymentRouteCurrencyOption | null | undefined;
  currencyOut: PaymentRouteCurrencyOption | null | undefined;
}) {
  const cleanForward = formatCurrencyRatio({
    amountInMinor: input.amountInMinor,
    amountOutMinor: input.cleanAmountOutMinor,
    currencyIn: input.currencyIn,
    currencyOut: input.currencyOut,
  });
  const cleanReverse =
    input.currencyIn && input.currencyOut
      ? formatCurrencyRatio({
          amountInMinor: input.cleanAmountOutMinor,
          amountOutMinor: input.amountInMinor,
          currencyIn: input.currencyOut,
          currencyOut: input.currencyIn,
        })
      : null;

  const effectiveForward =
    input.costInclusiveAmountInMinor && input.currencyIn && input.currencyOut
      ? formatCurrencyRatio({
          amountInMinor: input.costInclusiveAmountInMinor,
          amountOutMinor: input.effectiveAmountOutMinor,
          currencyIn: input.currencyIn,
          currencyOut: input.currencyOut,
        })
      : null;
  const effectiveReverse =
    input.costInclusiveAmountInMinor && input.currencyIn && input.currencyOut
      ? formatCurrencyRatio({
          amountInMinor: input.effectiveAmountOutMinor,
          amountOutMinor: input.costInclusiveAmountInMinor,
          currencyIn: input.currencyOut,
          currencyOut: input.currencyIn,
        })
      : null;

  return {
    cleanForward,
    cleanReverse,
    effectiveForward,
    effectiveReverse,
  };
}

export function parseMajorToMinorAmount(input: {
  currency: PaymentRouteCurrencyOption | null | undefined;
  value: string;
}) {
  if (!input.currency) {
    return null;
  }

  try {
    return toMinorAmountString(input.value, input.currency.code, {
      requirePositive: true,
    });
  } catch {
    return null;
  }
}
