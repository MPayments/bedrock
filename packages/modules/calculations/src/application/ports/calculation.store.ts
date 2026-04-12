import type {
  CalculationLineKind,
  CalculationRateSource,
} from "../../domain/constants";

export interface CreateCalculationRootInput {
  id: string;
  isActive?: boolean;
}

export interface CreateCalculationSnapshotInput {
  agreementFeeAmountMinor: bigint;
  agreementFeeBps: bigint;
  agreementVersionId: string | null;
  additionalExpensesAmountMinor: bigint;
  additionalExpensesCurrencyId: string | null;
  additionalExpensesInBaseMinor: bigint;
  additionalExpensesRateDen: bigint | null;
  additionalExpensesRateNum: bigint | null;
  additionalExpensesRateSource: CalculationRateSource | null;
  baseCurrencyId: string;
  calculationCurrencyId: string;
  calculationId: string;
  calculationTimestamp: Date;
  fixedFeeAmountMinor: bigint;
  fixedFeeCurrencyId: string | null;
  fxQuoteId: string | null;
  id: string;
  originalAmountMinor: bigint;
  pricingProvenance: Record<string, unknown> | null;
  quoteSnapshot: Record<string, unknown> | null;
  quoteMarkupAmountMinor: bigint;
  quoteMarkupBps: bigint;
  rateDen: bigint;
  rateNum: bigint;
  rateSource: CalculationRateSource;
  referenceRateAsOf: Date | null;
  referenceRateDen: bigint | null;
  referenceRateNum: bigint | null;
  referenceRateSource: CalculationRateSource | null;
  snapshotNumber: number;
  totalAmountMinor: bigint;
  totalFeeAmountInBaseMinor: bigint;
  totalFeeAmountMinor: bigint;
  totalFeeBps: bigint;
  totalInBaseMinor: bigint;
  totalWithExpensesInBaseMinor: bigint;
}

export interface CreateCalculationLineStoredInput {
  amountMinor: bigint;
  calculationSnapshotId: string;
  currencyId: string;
  id: string;
  idx: number;
  kind: CalculationLineKind;
}

export interface CalculationStore {
  createCalculationLines(
    input: CreateCalculationLineStoredInput[],
  ): Promise<void>;
  createCalculationRoot(input: CreateCalculationRootInput): Promise<void>;
  createCalculationSnapshot(input: CreateCalculationSnapshotInput): Promise<void>;
  setActive(input: { calculationId: string; isActive: boolean }): Promise<void>;
  setCurrentSnapshot(input: {
    calculationId: string;
    currentSnapshotId: string;
  }): Promise<void>;
}
