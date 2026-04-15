import type {
  CalculationComponentBasisType,
  CalculationComponentClassification,
  CalculationComponentFormulaType,
  CalculationLineKind,
  CalculationLineSourceKind,
  CalculationRateSource,
  CalculationState,
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
  dealId: string | null;
  dealSnapshot: Record<string, unknown> | null;
  fixedFeeAmountMinor: bigint;
  fixedFeeCurrencyId: string | null;
  fxQuoteId: string | null;
  grossRevenueInBaseMinor: bigint;
  id: string;
  originalAmountMinor: bigint;
  pricingProvenance: Record<string, unknown> | null;
  quoteSnapshot: Record<string, unknown> | null;
  quoteMarkupAmountMinor: bigint;
  quoteMarkupBps: bigint;
  rateDen: bigint;
  rateNum: bigint;
  rateSource: CalculationRateSource;
  routeSnapshot: Record<string, unknown> | null;
  routeVersionId: string | null;
  expenseAmountInBaseMinor: bigint;
  netMarginInBaseMinor: bigint;
  passThroughAmountInBaseMinor: bigint;
  referenceRateAsOf: Date | null;
  referenceRateDen: bigint | null;
  referenceRateNum: bigint | null;
  referenceRateSource: CalculationRateSource | null;
  snapshotNumber: number;
  state: CalculationState;
  totalAmountMinor: bigint;
  totalFeeAmountInBaseMinor: bigint;
  totalFeeAmountMinor: bigint;
  totalFeeBps: bigint;
  totalInBaseMinor: bigint;
  totalWithExpensesInBaseMinor: bigint;
}

export interface CreateCalculationLineStoredInput {
  amountMinor: bigint;
  basisAmountMinor: bigint | null;
  basisType: CalculationComponentBasisType | null;
  calculationSnapshotId: string;
  classification: CalculationComponentClassification | null;
  componentCode: string | null;
  componentFamily: string | null;
  currencyId: string;
  dealId: string | null;
  formulaType: CalculationComponentFormulaType | null;
  id: string;
  idx: number;
  inputBps: string | null;
  inputFixedAmountMinor: bigint | null;
  inputManualAmountMinor: bigint | null;
  inputPerMillion: string | null;
  kind: CalculationLineKind;
  routeComponentId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceKind: CalculationLineSourceKind;
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
