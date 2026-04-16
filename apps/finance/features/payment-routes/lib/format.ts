import { minorToAmountString, toMinorAmountString } from "@bedrock/shared/money";

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
    const amountIn = Number(
      minorToAmountString(input.amountInMinor, {
        precision: input.currencyIn.precision,
      }),
    );
    const amountOut = Number(
      minorToAmountString(input.amountOutMinor, {
        precision: input.currencyOut.precision,
      }),
    );

    if (!Number.isFinite(amountIn) || !Number.isFinite(amountOut) || amountIn <= 0) {
      return null;
    }

    const ratio = amountOut / amountIn;
    return `1 ${input.currencyIn.code} ~= ${ratio.toFixed(6)} ${input.currencyOut.code}`;
  } catch {
    return null;
  }
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

