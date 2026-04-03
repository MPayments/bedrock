import type {
  CalculationLineKind,
  CalculationRateSource,
} from "../../domain/constants";

export interface CreateCalculationRootInput {
  id: string;
  isActive?: boolean;
}

export interface CreateCalculationSnapshotInput {
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
  feeAmountInBaseMinor: bigint;
  feeAmountMinor: bigint;
  feeBps: bigint;
  fxQuoteId: string | null;
  id: string;
  originalAmountMinor: bigint;
  quoteSnapshot: Record<string, unknown> | null;
  rateDen: bigint;
  rateNum: bigint;
  rateSource: CalculationRateSource;
  snapshotNumber: number;
  totalAmountMinor: bigint;
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
