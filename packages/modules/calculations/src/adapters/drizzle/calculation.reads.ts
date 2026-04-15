import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { calculationLines, calculations, calculationSnapshots } from "./schema";
import type {
  Calculation,
  CalculationDetails,
  CalculationLine,
  CalculationSnapshot,
} from "../../application/contracts/dto";
import type { ListCalculationsQuery } from "../../application/contracts/queries";
import type { CalculationReads } from "../../application/ports/calculation.reads";

const CALCULATIONS_SORT_COLUMN_MAP = {
  calculationTimestamp: calculationSnapshots.calculationTimestamp,
  createdAt: calculations.createdAt,
  updatedAt: calculations.updatedAt,
} as const;

const calculationSelect = {
  id: calculations.id,
  isActive: calculations.isActive,
  createdAt: calculations.createdAt,
  updatedAt: calculations.updatedAt,
  currentSnapshotId: calculationSnapshots.id,
  snapshotNumber: calculationSnapshots.snapshotNumber,
  agreementVersionId: calculationSnapshots.agreementVersionId,
  agreementFeeBps: calculationSnapshots.agreementFeeBps,
  agreementFeeAmountMinor: calculationSnapshots.agreementFeeAmountMinor,
  calculationCurrencyId: calculationSnapshots.calculationCurrencyId,
  originalAmountMinor: calculationSnapshots.originalAmountMinor,
  totalFeeBps: calculationSnapshots.totalFeeBps,
  totalFeeAmountMinor: calculationSnapshots.totalFeeAmountMinor,
  totalAmountMinor: calculationSnapshots.totalAmountMinor,
  baseCurrencyId: calculationSnapshots.baseCurrencyId,
  totalFeeAmountInBaseMinor: calculationSnapshots.totalFeeAmountInBaseMinor,
  totalInBaseMinor: calculationSnapshots.totalInBaseMinor,
  dealId: calculationSnapshots.dealId,
  dealSnapshot: calculationSnapshots.dealSnapshot,
  additionalExpensesCurrencyId:
    calculationSnapshots.additionalExpensesCurrencyId,
  additionalExpensesAmountMinor:
    calculationSnapshots.additionalExpensesAmountMinor,
  additionalExpensesInBaseMinor:
    calculationSnapshots.additionalExpensesInBaseMinor,
  fixedFeeAmountMinor: calculationSnapshots.fixedFeeAmountMinor,
  fixedFeeCurrencyId: calculationSnapshots.fixedFeeCurrencyId,
  quoteMarkupBps: calculationSnapshots.quoteMarkupBps,
  quoteMarkupAmountMinor: calculationSnapshots.quoteMarkupAmountMinor,
  grossRevenueInBaseMinor: calculationSnapshots.grossRevenueInBaseMinor,
  expenseAmountInBaseMinor: calculationSnapshots.expenseAmountInBaseMinor,
  passThroughAmountInBaseMinor:
    calculationSnapshots.passThroughAmountInBaseMinor,
  netMarginInBaseMinor: calculationSnapshots.netMarginInBaseMinor,
  routeVersionId: calculationSnapshots.routeVersionId,
  routeSnapshot: calculationSnapshots.routeSnapshot,
  referenceRateSource: calculationSnapshots.referenceRateSource,
  referenceRateNum: calculationSnapshots.referenceRateNum,
  referenceRateDen: calculationSnapshots.referenceRateDen,
  referenceRateAsOf: calculationSnapshots.referenceRateAsOf,
  pricingProvenance: calculationSnapshots.pricingProvenance,
  totalWithExpensesInBaseMinor:
    calculationSnapshots.totalWithExpensesInBaseMinor,
  rateSource: calculationSnapshots.rateSource,
  rateNum: calculationSnapshots.rateNum,
  rateDen: calculationSnapshots.rateDen,
  additionalExpensesRateSource:
    calculationSnapshots.additionalExpensesRateSource,
  additionalExpensesRateNum: calculationSnapshots.additionalExpensesRateNum,
  additionalExpensesRateDen: calculationSnapshots.additionalExpensesRateDen,
  calculationTimestamp: calculationSnapshots.calculationTimestamp,
  fxQuoteId: calculationSnapshots.fxQuoteId,
  quoteSnapshot: calculationSnapshots.quoteSnapshot,
  state: calculationSnapshots.state,
  snapshotCreatedAt: calculationSnapshots.createdAt,
  snapshotUpdatedAt: calculationSnapshots.updatedAt,
};

interface CalculationRow {
  id: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  currentSnapshotId: string;
  snapshotNumber: number;
  agreementVersionId: string | null;
  agreementFeeBps: bigint;
  agreementFeeAmountMinor: bigint;
  calculationCurrencyId: string;
  originalAmountMinor: bigint;
  totalFeeBps: bigint;
  totalFeeAmountMinor: bigint;
  totalAmountMinor: bigint;
  baseCurrencyId: string;
  totalFeeAmountInBaseMinor: bigint;
  totalInBaseMinor: bigint;
  dealId: string | null;
  dealSnapshot: Record<string, unknown> | null;
  additionalExpensesCurrencyId: string | null;
  additionalExpensesAmountMinor: bigint;
  additionalExpensesInBaseMinor: bigint;
  fixedFeeAmountMinor: bigint;
  fixedFeeCurrencyId: string | null;
  quoteMarkupBps: bigint;
  quoteMarkupAmountMinor: bigint;
  grossRevenueInBaseMinor: bigint;
  expenseAmountInBaseMinor: bigint;
  passThroughAmountInBaseMinor: bigint;
  netMarginInBaseMinor: bigint;
  routeVersionId: string | null;
  routeSnapshot: Record<string, unknown> | null;
  referenceRateSource:
    | "cbr"
    | "investing"
    | "xe"
    | "manual"
    | "fx_quote"
    | null;
  referenceRateNum: bigint | null;
  referenceRateDen: bigint | null;
  referenceRateAsOf: Date | null;
  pricingProvenance: Record<string, unknown> | null;
  totalWithExpensesInBaseMinor: bigint;
  rateSource: "cbr" | "investing" | "xe" | "manual" | "fx_quote";
  rateNum: bigint;
  rateDen: bigint;
  additionalExpensesRateSource:
    | "cbr"
    | "investing"
    | "xe"
    | "manual"
    | "fx_quote"
    | null;
  additionalExpensesRateNum: bigint | null;
  additionalExpensesRateDen: bigint | null;
  calculationTimestamp: Date;
  fxQuoteId: string | null;
  quoteSnapshot: Record<string, unknown> | null;
  state:
    | "draft"
    | "offered"
    | "accepted"
    | "expired"
    | "cancelled"
    | "superseded";
  snapshotCreatedAt: Date;
  snapshotUpdatedAt: Date;
}

function mapSnapshot(row: CalculationRow): CalculationSnapshot {
  return {
    id: row.currentSnapshotId,
    snapshotNumber: Number(row.snapshotNumber),
    agreementVersionId: row.agreementVersionId,
    agreementFeeBps: row.agreementFeeBps.toString(),
    agreementFeeAmountMinor: row.agreementFeeAmountMinor.toString(),
    calculationCurrencyId: row.calculationCurrencyId,
    originalAmountMinor: row.originalAmountMinor.toString(),
    totalFeeBps: row.totalFeeBps.toString(),
    totalFeeAmountMinor: row.totalFeeAmountMinor.toString(),
    totalAmountMinor: row.totalAmountMinor.toString(),
    baseCurrencyId: row.baseCurrencyId,
    totalFeeAmountInBaseMinor: row.totalFeeAmountInBaseMinor.toString(),
    totalInBaseMinor: row.totalInBaseMinor.toString(),
    dealId: row.dealId,
    dealSnapshot: row.dealSnapshot,
    additionalExpensesCurrencyId: row.additionalExpensesCurrencyId,
    additionalExpensesAmountMinor: row.additionalExpensesAmountMinor.toString(),
    additionalExpensesInBaseMinor: row.additionalExpensesInBaseMinor.toString(),
    fixedFeeAmountMinor: row.fixedFeeAmountMinor.toString(),
    fixedFeeCurrencyId: row.fixedFeeCurrencyId,
    quoteMarkupBps: row.quoteMarkupBps.toString(),
    quoteMarkupAmountMinor: row.quoteMarkupAmountMinor.toString(),
    grossRevenueInBaseMinor: row.grossRevenueInBaseMinor.toString(),
    expenseAmountInBaseMinor: row.expenseAmountInBaseMinor.toString(),
    passThroughAmountInBaseMinor:
      row.passThroughAmountInBaseMinor.toString(),
    netMarginInBaseMinor: row.netMarginInBaseMinor.toString(),
    routeVersionId: row.routeVersionId,
    routeSnapshot: row.routeSnapshot,
    referenceRateSource: row.referenceRateSource,
    referenceRateNum: row.referenceRateNum?.toString() ?? null,
    referenceRateDen: row.referenceRateDen?.toString() ?? null,
    referenceRateAsOf: row.referenceRateAsOf,
    pricingProvenance: row.pricingProvenance,
    state: row.state,
    totalWithExpensesInBaseMinor: row.totalWithExpensesInBaseMinor.toString(),
    rateSource: row.rateSource,
    rateNum: row.rateNum.toString(),
    rateDen: row.rateDen.toString(),
    additionalExpensesRateSource: row.additionalExpensesRateSource,
    additionalExpensesRateNum:
      row.additionalExpensesRateNum?.toString() ?? null,
    additionalExpensesRateDen:
      row.additionalExpensesRateDen?.toString() ?? null,
    calculationTimestamp: row.calculationTimestamp,
    fxQuoteId: row.fxQuoteId,
    quoteSnapshot: row.quoteSnapshot,
    createdAt: row.snapshotCreatedAt,
    updatedAt: row.snapshotUpdatedAt,
  };
}

function mapCalculation(row: CalculationRow): Calculation {
  return {
    id: row.id,
    isActive: row.isActive,
    currentSnapshot: mapSnapshot(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLineRow(row: {
  basisAmountMinor: bigint | null;
  basisType:
    | "deal_source_amount"
    | "deal_target_amount"
    | "leg_from_amount"
    | "leg_to_amount"
    | "gross_revenue"
    | null;
  classification:
    | "revenue"
    | "expense"
    | "pass_through"
    | "adjustment"
    | null;
  componentCode: string | null;
  componentFamily: string | null;
  id: string;
  idx: number;
  kind:
    | "additional_expenses"
    | "additional_expenses_in_base"
    | "adjustment"
    | "fee_amount"
    | "fee_amount_in_base"
    | "fee_revenue"
    | "original_amount"
    | "pass_through"
    | "provider_fee_expense"
    | "spread_revenue"
    | "total_amount"
    | "total_in_base"
    | "total_with_expenses_in_base";
  currencyId: string;
  dealId: string | null;
  formulaType: "fixed" | "bps" | "per_million" | "manual" | null;
  inputBps: string | null;
  inputFixedAmountMinor: bigint | null;
  inputManualAmountMinor: bigint | null;
  inputPerMillion: string | null;
  amountMinor: bigint;
  routeComponentId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceKind: "manual" | "agreement" | "quote" | "provider" | "system";
  createdAt: Date;
  updatedAt: Date;
}): CalculationLine {
  return {
    basisAmountMinor: row.basisAmountMinor?.toString() ?? null,
    basisType: row.basisType,
    classification: row.classification,
    componentCode: row.componentCode,
    componentFamily: row.componentFamily,
    id: row.id,
    idx: Number(row.idx),
    kind: row.kind,
    currencyId: row.currencyId,
    dealId: row.dealId,
    formulaType: row.formulaType,
    inputBps: row.inputBps,
    inputFixedAmountMinor: row.inputFixedAmountMinor?.toString() ?? null,
    inputManualAmountMinor: row.inputManualAmountMinor?.toString() ?? null,
    inputPerMillion: row.inputPerMillion,
    amountMinor: row.amountMinor.toString(),
    routeComponentId: row.routeComponentId,
    routeLegId: row.routeLegId,
    routeVersionId: row.routeVersionId,
    sourceKind: row.sourceKind,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleCalculationReads implements CalculationReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<CalculationDetails | null> {
    const [summary] = (await this.baseSelect()
      .where(eq(calculations.id, id))
      .limit(1)) as CalculationRow[];

    if (!summary) {
      return null;
    }

    const lineRows = await this.db
      .select({
        basisAmountMinor: calculationLines.basisAmountMinor,
        basisType: calculationLines.basisType,
        classification: calculationLines.classification,
        componentCode: calculationLines.componentCode,
        componentFamily: calculationLines.componentFamily,
        id: calculationLines.id,
        idx: calculationLines.idx,
        kind: calculationLines.kind,
        currencyId: calculationLines.currencyId,
        dealId: calculationLines.dealId,
        formulaType: calculationLines.formulaType,
        inputBps: calculationLines.inputBps,
        inputFixedAmountMinor: calculationLines.inputFixedAmountMinor,
        inputManualAmountMinor: calculationLines.inputManualAmountMinor,
        inputPerMillion: calculationLines.inputPerMillion,
        amountMinor: calculationLines.amountMinor,
        routeComponentId: calculationLines.routeComponentId,
        routeLegId: calculationLines.routeLegId,
        routeVersionId: calculationLines.routeVersionId,
        sourceKind: calculationLines.sourceKind,
        createdAt: calculationLines.createdAt,
        updatedAt: calculationLines.updatedAt,
      })
      .from(calculationLines)
      .where(
        eq(calculationLines.calculationSnapshotId, summary.currentSnapshotId),
      )
      .orderBy(asc(calculationLines.idx));

    return {
      ...mapCalculation(summary),
      lines: lineRows.map(mapLineRow),
    };
  }

  async list(
    input: ListCalculationsQuery,
  ): Promise<PaginatedList<Calculation>> {
    const conditions: SQL[] = [];

    if (input.isActive !== undefined) {
      conditions.push(eq(calculations.isActive, input.isActive));
    } else {
      conditions.push(eq(calculations.isActive, true));
    }

    const where = and(...conditions);
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      CALCULATIONS_SORT_COLUMN_MAP,
      calculations.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.baseSelect()
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(calculations)
        .innerJoin(
          calculationSnapshots,
          eq(calculations.currentSnapshotId, calculationSnapshots.id),
        )
        .where(where),
    ]);

    return {
      data: (rows as CalculationRow[]).map(mapCalculation),
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  private baseSelect() {
    return this.db
      .select(calculationSelect)
      .from(calculations)
      .innerJoin(
        calculationSnapshots,
        eq(calculations.currentSnapshotId, calculationSnapshots.id),
      );
  }
}
