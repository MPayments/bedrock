import type {
  CalculationLineKind,
} from "./constants";

export interface CalculationLineDraft {
  amountMinor: bigint;
  currencyId: string;
  idx: number;
  kind: CalculationLineKind;
}

export interface CalculationSnapshotAmounts {
  additionalExpensesAmountMinor: bigint;
  additionalExpensesCurrencyId: string | null;
  additionalExpensesInBaseMinor: bigint;
  baseCurrencyId: string;
  calculationCurrencyId: string;
  feeAmountInBaseMinor: bigint;
  feeAmountMinor: bigint;
  originalAmountMinor: bigint;
  totalAmountMinor: bigint;
  totalInBaseMinor: bigint;
  totalWithExpensesInBaseMinor: bigint;
}

export function buildCalculationLineDrafts(
  snapshot: CalculationSnapshotAmounts,
): CalculationLineDraft[] {
  const additionalExpensesCurrencyId =
    snapshot.additionalExpensesCurrencyId ?? snapshot.baseCurrencyId;

  return [
    {
      idx: 0,
      kind: "original_amount",
      currencyId: snapshot.calculationCurrencyId,
      amountMinor: snapshot.originalAmountMinor,
    },
    {
      idx: 1,
      kind: "fee_amount",
      currencyId: snapshot.calculationCurrencyId,
      amountMinor: snapshot.feeAmountMinor,
    },
    {
      idx: 2,
      kind: "total_amount",
      currencyId: snapshot.calculationCurrencyId,
      amountMinor: snapshot.totalAmountMinor,
    },
    {
      // When the source currency is omitted, treat expenses as already base-denominated.
      idx: 3,
      kind: "additional_expenses",
      currencyId: additionalExpensesCurrencyId,
      amountMinor: snapshot.additionalExpensesAmountMinor,
    },
    {
      idx: 4,
      kind: "fee_amount_in_base",
      currencyId: snapshot.baseCurrencyId,
      amountMinor: snapshot.feeAmountInBaseMinor,
    },
    {
      idx: 5,
      kind: "total_in_base",
      currencyId: snapshot.baseCurrencyId,
      amountMinor: snapshot.totalInBaseMinor,
    },
    {
      idx: 6,
      kind: "additional_expenses_in_base",
      currencyId: snapshot.baseCurrencyId,
      amountMinor: snapshot.additionalExpensesInBaseMinor,
    },
    {
      idx: 7,
      kind: "total_with_expenses_in_base",
      currencyId: snapshot.baseCurrencyId,
      amountMinor: snapshot.totalWithExpensesInBaseMinor,
    },
  ];
}
