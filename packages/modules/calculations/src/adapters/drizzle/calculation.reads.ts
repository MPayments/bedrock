import {
  and,
  asc,
  desc,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  calculationApplicationLinks,
  calculationLines,
  calculations,
  calculationSnapshots,
} from "./schema";
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
  calculationCurrencyId: calculationSnapshots.calculationCurrencyId,
  originalAmountMinor: calculationSnapshots.originalAmountMinor,
  feeBps: calculationSnapshots.feeBps,
  feeAmountMinor: calculationSnapshots.feeAmountMinor,
  totalAmountMinor: calculationSnapshots.totalAmountMinor,
  baseCurrencyId: calculationSnapshots.baseCurrencyId,
  feeAmountInBaseMinor: calculationSnapshots.feeAmountInBaseMinor,
  totalInBaseMinor: calculationSnapshots.totalInBaseMinor,
  additionalExpensesCurrencyId: calculationSnapshots.additionalExpensesCurrencyId,
  additionalExpensesAmountMinor:
    calculationSnapshots.additionalExpensesAmountMinor,
  additionalExpensesInBaseMinor:
    calculationSnapshots.additionalExpensesInBaseMinor,
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
  snapshotCreatedAt: calculationSnapshots.createdAt,
  snapshotUpdatedAt: calculationSnapshots.updatedAt,
};

type CalculationRow = {
  id: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  currentSnapshotId: string;
  snapshotNumber: number;
  calculationCurrencyId: string;
  originalAmountMinor: bigint;
  feeBps: bigint;
  feeAmountMinor: bigint;
  totalAmountMinor: bigint;
  baseCurrencyId: string;
  feeAmountInBaseMinor: bigint;
  totalInBaseMinor: bigint;
  additionalExpensesCurrencyId: string | null;
  additionalExpensesAmountMinor: bigint;
  additionalExpensesInBaseMinor: bigint;
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
  snapshotCreatedAt: Date;
  snapshotUpdatedAt: Date;
};

function mapSnapshot(row: CalculationRow): CalculationSnapshot {
  return {
    id: row.currentSnapshotId,
    snapshotNumber: Number(row.snapshotNumber),
    calculationCurrencyId: row.calculationCurrencyId,
    originalAmountMinor: row.originalAmountMinor.toString(),
    feeBps: row.feeBps.toString(),
    feeAmountMinor: row.feeAmountMinor.toString(),
    totalAmountMinor: row.totalAmountMinor.toString(),
    baseCurrencyId: row.baseCurrencyId,
    feeAmountInBaseMinor: row.feeAmountInBaseMinor.toString(),
    totalInBaseMinor: row.totalInBaseMinor.toString(),
    additionalExpensesCurrencyId: row.additionalExpensesCurrencyId,
    additionalExpensesAmountMinor: row.additionalExpensesAmountMinor.toString(),
    additionalExpensesInBaseMinor: row.additionalExpensesInBaseMinor.toString(),
    totalWithExpensesInBaseMinor:
      row.totalWithExpensesInBaseMinor.toString(),
    rateSource: row.rateSource,
    rateNum: row.rateNum.toString(),
    rateDen: row.rateDen.toString(),
    additionalExpensesRateSource: row.additionalExpensesRateSource,
    additionalExpensesRateNum: row.additionalExpensesRateNum?.toString() ?? null,
    additionalExpensesRateDen: row.additionalExpensesRateDen?.toString() ?? null,
    calculationTimestamp: row.calculationTimestamp,
    fxQuoteId: row.fxQuoteId,
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
  id: string;
  idx: number;
  kind:
    | "additional_expenses"
    | "additional_expenses_in_base"
    | "fee_amount"
    | "fee_amount_in_base"
    | "original_amount"
    | "total_amount"
    | "total_in_base"
    | "total_with_expenses_in_base";
  currencyId: string;
  amountMinor: bigint;
  createdAt: Date;
  updatedAt: Date;
}): CalculationLine {
  return {
    id: row.id,
    idx: Number(row.idx),
    kind: row.kind,
    currencyId: row.currencyId,
    amountMinor: row.amountMinor.toString(),
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
        id: calculationLines.id,
        idx: calculationLines.idx,
        kind: calculationLines.kind,
        currencyId: calculationLines.currencyId,
        amountMinor: calculationLines.amountMinor,
        createdAt: calculationLines.createdAt,
        updatedAt: calculationLines.updatedAt,
      })
      .from(calculationLines)
      .where(eq(calculationLines.calculationSnapshotId, summary.currentSnapshotId))
      .orderBy(asc(calculationLines.idx));

    return {
      ...mapCalculation(summary),
      lines: lineRows.map(mapLineRow),
    };
  }

  async findApplicationIdByCalculationId(id: string): Promise<number | null> {
    const [row] = await this.db
      .select({ applicationId: calculationApplicationLinks.applicationId })
      .from(calculationApplicationLinks)
      .where(eq(calculationApplicationLinks.calculationId, id))
      .limit(1);

    return row?.applicationId ?? null;
  }

  async findLatestByApplicationId(
    applicationId: number,
  ): Promise<Calculation | null> {
    const [row] = (await this.baseSelect()
      .innerJoin(
        calculationApplicationLinks,
        eq(calculationApplicationLinks.calculationId, calculations.id),
      )
      .where(eq(calculationApplicationLinks.applicationId, applicationId))
      .orderBy(desc(calculations.createdAt), desc(calculations.id))
      .limit(1)) as CalculationRow[];

    return row ? mapCalculation(row) : null;
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

  async listByApplicationId(applicationId: number): Promise<Calculation[]> {
    const rows = (await this.baseSelect()
      .innerJoin(
        calculationApplicationLinks,
        eq(calculationApplicationLinks.calculationId, calculations.id),
      )
      .where(eq(calculationApplicationLinks.applicationId, applicationId))
      .orderBy(desc(calculations.createdAt), desc(calculations.id))) as
      CalculationRow[];

    return rows.map(mapCalculation);
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
