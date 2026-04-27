import type {
  CalculationDetailsLike,
  CurrencyDetailsLike,
  DealListRecord,
  DealProjectionsWorkflowDeps,
} from "./deps";
import { parseDecimalOrZero, parseMinorOrZero, toMap, toMinorOrZero } from "./utils";

export function buildCrmDealMoneySummary(input: {
  deal: DealListRecord;
  calculation: CalculationDetailsLike | null;
  sourceCurrency: CurrencyDetailsLike | null;
  baseCurrency: CurrencyDetailsLike | null;
}) {
  const currencyCode = input.sourceCurrency?.code ?? "RUB";
  const sourcePrecision = input.sourceCurrency?.precision ?? 2;
  const amountMinor = toMinorOrZero(input.deal.amount, currencyCode);
  const amount = parseDecimalOrZero(input.deal.amount);

  const amountInBaseMinor =
    input.calculation && input.baseCurrency
      ? BigInt(input.calculation.currentSnapshot.totalInBaseMinor)
      : amountMinor;
  const amountInBase =
    input.calculation && input.baseCurrency
      ? parseMinorOrZero(
          input.calculation.currentSnapshot.totalInBaseMinor,
          input.baseCurrency.precision,
        )
      : parseMinorOrZero(amountMinor, sourcePrecision);
  const feePercentage = input.calculation
    ? parseMinorOrZero(input.calculation.currentSnapshot.totalFeeBps, 2)
    : 0;

  return {
    amount,
    amountInBase,
    amountInBaseMinor,
    amountMinor,
    baseCurrencyCode: input.baseCurrency?.code ?? currencyCode,
    currencyCode,
    feePercentage,
  };
}

export async function loadDealMoneyLookups(
  listedDeals: DealListRecord[],
  deps: Pick<DealProjectionsWorkflowDeps, "calculations" | "currencies">,
) {
  const calculationIds = [
    ...new Set(
      listedDeals
        .map((deal) => deal.calculationId)
        .filter((calculationId): calculationId is string =>
          Boolean(calculationId),
        ),
    ),
  ];
  const sourceCurrencyIds = [
    ...new Set(
      listedDeals
        .map((deal) => deal.currencyId)
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    ),
  ];

  const calculationsById = toMap(
    await Promise.all(
      calculationIds.map(
        async (
          calculationId,
        ): Promise<readonly [string, CalculationDetailsLike | null]> =>
          [
            calculationId,
            (await deps.calculations.calculations.queries.findById(
              calculationId,
            )) ?? null,
          ] as const,
      ),
    ),
  );
  const baseCurrencyIds = [
    ...new Set(
      Array.from(calculationsById.values())
        .map(
          (calculation) => calculation?.currentSnapshot.baseCurrencyId ?? null,
        )
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    ),
  ];

  const [currenciesById, baseCurrenciesById] = await Promise.all([
    Promise.all(
      sourceCurrencyIds.map(
        async (currencyId): Promise<readonly [string, CurrencyDetailsLike]> =>
          [currencyId, await deps.currencies.findById(currencyId)] as const,
      ),
    ).then(toMap),
    Promise.all(
      baseCurrencyIds.map(
        async (currencyId): Promise<readonly [string, CurrencyDetailsLike]> =>
          [currencyId, await deps.currencies.findById(currencyId)] as const,
      ),
    ).then(toMap),
  ]);

  return {
    baseCurrenciesById,
    calculationsById,
    currenciesById,
  };
}
