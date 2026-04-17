import { minorToAmountString, toMinorAmountString } from "@bedrock/shared/money";
import { mulDivRoundHalfUp } from "@bedrock/shared/money/math";

import { getLatestRate } from "@/features/treasury/rates/lib/queries";
import { ApiRequestError } from "@/lib/api/response";

export type TreasuryBalancesEvaluationAmount = {
  amount: string;
  currency: string;
};

export type TreasuryBalancesEvaluationSummary = {
  amount: string | null;
  currency: string;
  isComplete: boolean;
  missingCurrencies: string[];
};

function getMinorUnit(currency: string) {
  return BigInt(toMinorAmountString("1", currency));
}

function toMinorAmount(value: string, currency: string) {
  return BigInt(toMinorAmountString(value, currency));
}

function convertMajorRateAmountToMinor(input: {
  amountMinor: bigint;
  baseCurrency: string;
  quoteCurrency: string;
  rateDen: string;
  rateNum: string;
}) {
  const baseMinorUnit = getMinorUnit(input.baseCurrency);
  const quoteMinorUnit = getMinorUnit(input.quoteCurrency);

  return mulDivRoundHalfUp(
    input.amountMinor,
    BigInt(input.rateNum) * quoteMinorUnit,
    BigInt(input.rateDen) * baseMinorUnit,
  );
}

export async function getTreasuryBalancesEvaluationTotal(input: {
  asOf: string;
  currencyAmounts: TreasuryBalancesEvaluationAmount[];
  evaluationCurrency: string;
}): Promise<TreasuryBalancesEvaluationSummary> {
  const evaluationCurrency = input.evaluationCurrency.toUpperCase();
  const currencyAmounts = input.currencyAmounts
    .map((item) => ({
      amountMinor: toMinorAmount(item.amount, item.currency),
      currency: item.currency.toUpperCase(),
    }))
    .filter((item) => item.amountMinor !== 0n);

  if (currencyAmounts.length === 0) {
    return {
      amount: minorToAmountString(0n, { currency: evaluationCurrency }),
      currency: evaluationCurrency,
      isComplete: true,
      missingCurrencies: [],
    };
  }

  const convertedAmounts = await Promise.all(
    currencyAmounts.map(async (item) => {
      if (item.currency === evaluationCurrency) {
        return {
          convertedMinor: item.amountMinor,
          currency: item.currency,
        };
      }

      try {
        const rate = await getLatestRate(
          item.currency,
          evaluationCurrency,
          input.asOf,
        );

        return {
          convertedMinor: convertMajorRateAmountToMinor({
            amountMinor: item.amountMinor,
            baseCurrency: item.currency,
            quoteCurrency: evaluationCurrency,
            rateDen: rate.rateDen,
            rateNum: rate.rateNum,
          }),
          currency: item.currency,
        };
      } catch (error) {
        if (
          error instanceof ApiRequestError &&
          (error.status === 404 || error.status === 503)
        ) {
          return {
            convertedMinor: null,
            currency: item.currency,
          };
        }

        throw error;
      }
    }),
  );

  const missingCurrencies = convertedAmounts
    .filter((item) => item.convertedMinor === null)
    .map((item) => item.currency);
  if (missingCurrencies.length > 0) {
    return {
      amount: null,
      currency: evaluationCurrency,
      isComplete: false,
      missingCurrencies,
    };
  }

  const totalMinor = convertedAmounts.reduce(
    (accumulator, item) => accumulator + (item.convertedMinor ?? 0n),
    0n,
  );

  return {
    amount: minorToAmountString(totalMinor, { currency: evaluationCurrency }),
    currency: evaluationCurrency,
    isComplete: true,
    missingCurrencies: [],
  };
}
