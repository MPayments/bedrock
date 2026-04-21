import {
  formatDecimalString,
  formatFractionDecimal,
  minorToAmountString,
  toMinorAmountString,
} from "@bedrock/shared/money";
import { mulDivRoundHalfUp } from "@bedrock/shared/money/math";
import type { PaymentRouteCalculation } from "@bedrock/treasury/contracts";

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

  const decimal = minorToAmountString(amountMinor, {
    precision: currency.precision,
  });

  try {
    return `${formatDecimalString(decimal, {
      groupSeparator: " ",
      maximumFractionDigits: currency.precision,
      minimumFractionDigits: currency.precision,
    })} ${currency.code}`;
  } catch {
    return `${decimal} ${currency.code}`;
  }
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
  cleanAmountInMinor: string;
  cleanAmountOutMinor: string;
  clientAmountOutMinor: string;
  clientTotalInMinor?: string | null;
  costAmountOutMinor: string;
  costPriceInMinor?: string | null;
  currencyIn: PaymentRouteCurrencyOption | null | undefined;
  currencyOut: PaymentRouteCurrencyOption | null | undefined;
}) {
  const cleanForward = formatCurrencyRatio({
    amountInMinor: input.cleanAmountInMinor,
    amountOutMinor: input.cleanAmountOutMinor,
    currencyIn: input.currencyIn,
    currencyOut: input.currencyOut,
  });
  const cleanReverse =
    input.currencyIn && input.currencyOut
      ? formatCurrencyRatio({
          amountInMinor: input.cleanAmountOutMinor,
          amountOutMinor: input.cleanAmountInMinor,
          currencyIn: input.currencyOut,
          currencyOut: input.currencyIn,
        })
      : null;

  const clientForward =
    input.clientTotalInMinor && input.currencyIn && input.currencyOut
      ? formatCurrencyRatio({
          amountInMinor: input.clientTotalInMinor,
          amountOutMinor: input.clientAmountOutMinor,
          currencyIn: input.currencyIn,
          currencyOut: input.currencyOut,
        })
      : null;
  const clientReverse =
    input.clientTotalInMinor && input.currencyIn && input.currencyOut
      ? formatCurrencyRatio({
          amountInMinor: input.clientAmountOutMinor,
          amountOutMinor: input.clientTotalInMinor,
          currencyIn: input.currencyOut,
          currencyOut: input.currencyIn,
        })
      : null;
  const costForward =
    input.costPriceInMinor && input.currencyIn && input.currencyOut
      ? formatCurrencyRatio({
          amountInMinor: input.costPriceInMinor,
          amountOutMinor: input.costAmountOutMinor,
          currencyIn: input.currencyIn,
          currencyOut: input.currencyOut,
        })
      : null;
  const costReverse =
    input.costPriceInMinor && input.currencyIn && input.currencyOut
      ? formatCurrencyRatio({
          amountInMinor: input.costAmountOutMinor,
          amountOutMinor: input.costPriceInMinor,
          currencyIn: input.currencyOut,
          currencyOut: input.currencyIn,
        })
      : null;

  return {
    cleanForward,
    cleanReverse,
    clientForward,
    clientReverse,
    costForward,
    costReverse,
  };
}

export function getPaymentRouteBaseRateLines(input: {
  calculation: PaymentRouteCalculation | null;
  currencies: PaymentRouteCurrencyOption[];
}) {
  const calculation = input.calculation;

  if (!calculation) {
    return {
      baseForward: null,
      baseReverse: null,
    };
  }

  const currencyIn =
    input.currencies.find((currency) => currency.id === calculation.currencyInId) ??
    null;
  const currencyOut =
    input.currencies.find((currency) => currency.id === calculation.currencyOutId) ??
    null;

  if (!currencyIn || !currencyOut) {
    return {
      baseForward: null,
      baseReverse: null,
    };
  }

  let numerator = 1n;
  let denominator = 1n;

  for (const leg of calculation.legs) {
    const fromCurrency =
      input.currencies.find((currency) => currency.id === leg.fromCurrencyId) ??
      null;
    const toCurrency =
      input.currencies.find((currency) => currency.id === leg.toCurrencyId) ??
      null;

    if (!fromCurrency || !toCurrency) {
      return {
        baseForward: null,
        baseReverse: null,
      };
    }

    numerator *=
      BigInt(leg.rateNum) * 10n ** BigInt(fromCurrency.precision);
    denominator *=
      BigInt(leg.rateDen) * 10n ** BigInt(toCurrency.precision);
  }

  if (numerator <= 0n || denominator <= 0n) {
    return {
      baseForward: null,
      baseReverse: null,
    };
  }

  return {
    baseForward: `1 ${currencyIn.code} ~= ${formatFractionDecimal(
      numerator.toString(),
      denominator.toString(),
      {
        scale: 6,
        trimTrailingZeros: true,
      },
    )} ${currencyOut.code}`,
    baseReverse: `1 ${currencyOut.code} ~= ${formatFractionDecimal(
      denominator.toString(),
      numerator.toString(),
      {
        scale: 6,
        trimTrailingZeros: true,
      },
    )} ${currencyIn.code}`,
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
