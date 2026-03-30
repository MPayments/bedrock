import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  feeBpsToPercentString,
  minorToDecimalString,
  rationalToDecimalString,
} from "@bedrock/calculations";
import {
  calculationApplicationLinks,
  calculations,
  calculationSnapshots,
} from "@bedrock/calculations/schema";
import { currencies } from "@bedrock/currencies/schema";
import type { Queryable } from "@bedrock/platform/persistence";

type CalculationCompatRow = {
  additionalExpensesAmountMinor: bigint;
  additionalExpensesCurrencyCode: string | null;
  additionalExpensesCurrencyPrecision: number | null;
  additionalExpensesInBaseMinor: bigint;
  applicationId: number | null;
  baseCurrencyCode: string;
  baseCurrencyPrecision: number;
  calculationCreatedAt: Date;
  calculationId: string;
  calculationTimestamp: Date;
  currencyCode: string;
  currencyPrecision: number;
  feeAmountInBaseMinor: bigint;
  feeAmountMinor: bigint;
  feeBps: bigint;
  originalAmountMinor: bigint;
  rateDen: bigint;
  rateNum: bigint;
  totalAmountMinor: bigint;
  totalInBaseMinor: bigint;
  totalWithExpensesInBaseMinor: bigint;
};

export interface CompatibilityCalculationSummary {
  additionalExpenses: string;
  additionalExpensesCurrencyCode: string | null;
  additionalExpensesInBase: string;
  applicationId: number | null;
  baseCurrencyCode: string;
  calculationId: string;
  calculationTimestamp: string;
  createdAt: string;
  currencyCode: string;
  feeAmount: string;
  feeAmountInBase: string;
  feePercentage: string;
  id: string;
  originalAmount: string;
  rate: string;
  totalAmount: string;
  totalInBase: string;
  totalWithExpensesInBase: string;
}

function mapCompatibilityCalculation(
  row: CalculationCompatRow,
): CompatibilityCalculationSummary {
  return {
    id: row.calculationId,
    calculationId: row.calculationId,
    applicationId: row.applicationId,
    currencyCode: row.currencyCode,
    originalAmount: minorToDecimalString(
      row.originalAmountMinor,
      row.currencyPrecision,
    ),
    feePercentage: feeBpsToPercentString(row.feeBps),
    feeAmount: minorToDecimalString(row.feeAmountMinor, row.currencyPrecision),
    totalAmount: minorToDecimalString(
      row.totalAmountMinor,
      row.currencyPrecision,
    ),
    rate: rationalToDecimalString(row.rateNum, row.rateDen),
    additionalExpensesCurrencyCode: row.additionalExpensesCurrencyCode,
    additionalExpenses: minorToDecimalString(
      row.additionalExpensesAmountMinor,
      row.additionalExpensesCurrencyPrecision ?? row.baseCurrencyPrecision,
    ),
    baseCurrencyCode: row.baseCurrencyCode,
    feeAmountInBase: minorToDecimalString(
      row.feeAmountInBaseMinor,
      row.baseCurrencyPrecision,
    ),
    totalInBase: minorToDecimalString(
      row.totalInBaseMinor,
      row.baseCurrencyPrecision,
    ),
    additionalExpensesInBase: minorToDecimalString(
      row.additionalExpensesInBaseMinor,
      row.baseCurrencyPrecision,
    ),
    totalWithExpensesInBase: minorToDecimalString(
      row.totalWithExpensesInBaseMinor,
      row.baseCurrencyPrecision,
    ),
    calculationTimestamp: row.calculationTimestamp.toISOString(),
    createdAt: row.calculationCreatedAt.toISOString(),
  };
}

function buildCompatSelect() {
  const calculationCurrency = alias(currencies, "calculation_currency");
  const baseCurrency = alias(currencies, "base_currency");
  const additionalExpensesCurrency = alias(
    currencies,
    "additional_expenses_currency",
  );

  return {
    calculationCurrency,
    baseCurrency,
    additionalExpensesCurrency,
    select: {
      calculationId: calculations.id,
      applicationId: calculationApplicationLinks.applicationId,
      calculationCreatedAt: calculations.createdAt,
      calculationTimestamp: calculationSnapshots.calculationTimestamp,
      currencyCode: calculationCurrency.code,
      currencyPrecision: calculationCurrency.precision,
      originalAmountMinor: calculationSnapshots.originalAmountMinor,
      feeBps: calculationSnapshots.feeBps,
      feeAmountMinor: calculationSnapshots.feeAmountMinor,
      totalAmountMinor: calculationSnapshots.totalAmountMinor,
      baseCurrencyCode: baseCurrency.code,
      baseCurrencyPrecision: baseCurrency.precision,
      feeAmountInBaseMinor: calculationSnapshots.feeAmountInBaseMinor,
      totalInBaseMinor: calculationSnapshots.totalInBaseMinor,
      additionalExpensesCurrencyCode: additionalExpensesCurrency.code,
      additionalExpensesCurrencyPrecision: additionalExpensesCurrency.precision,
      additionalExpensesAmountMinor:
        calculationSnapshots.additionalExpensesAmountMinor,
      additionalExpensesInBaseMinor:
        calculationSnapshots.additionalExpensesInBaseMinor,
      totalWithExpensesInBaseMinor:
        calculationSnapshots.totalWithExpensesInBaseMinor,
      rateNum: calculationSnapshots.rateNum,
      rateDen: calculationSnapshots.rateDen,
    },
  };
}

export async function getCompatibilityCalculationById(
  db: Queryable,
  calculationId: string,
): Promise<CompatibilityCalculationSummary | null> {
  const { additionalExpensesCurrency, baseCurrency, calculationCurrency, select } =
    buildCompatSelect();

  const [row] = await db
    .select(select)
    .from(calculations)
    .innerJoin(
      calculationSnapshots,
      eq(calculations.currentSnapshotId, calculationSnapshots.id),
    )
    .leftJoin(
      calculationApplicationLinks,
      eq(calculationApplicationLinks.calculationId, calculations.id),
    )
    .innerJoin(
      calculationCurrency,
      eq(calculationSnapshots.calculationCurrencyId, calculationCurrency.id),
    )
    .innerJoin(
      baseCurrency,
      eq(calculationSnapshots.baseCurrencyId, baseCurrency.id),
    )
    .leftJoin(
      additionalExpensesCurrency,
      eq(
        calculationSnapshots.additionalExpensesCurrencyId,
        additionalExpensesCurrency.id,
      ),
    )
    .where(eq(calculations.id, calculationId))
    .limit(1);

  return row ? mapCompatibilityCalculation(row as CalculationCompatRow) : null;
}

export async function listCompatibilityCalculationsByIds(
  db: Queryable,
  calculationIds: string[],
): Promise<Map<string, CompatibilityCalculationSummary>> {
  const result = new Map<string, CompatibilityCalculationSummary>();
  if (calculationIds.length === 0) {
    return result;
  }

  const { additionalExpensesCurrency, baseCurrency, calculationCurrency, select } =
    buildCompatSelect();

  const rows = await db
    .select(select)
    .from(calculations)
    .innerJoin(
      calculationSnapshots,
      eq(calculations.currentSnapshotId, calculationSnapshots.id),
    )
    .leftJoin(
      calculationApplicationLinks,
      eq(calculationApplicationLinks.calculationId, calculations.id),
    )
    .innerJoin(
      calculationCurrency,
      eq(calculationSnapshots.calculationCurrencyId, calculationCurrency.id),
    )
    .innerJoin(
      baseCurrency,
      eq(calculationSnapshots.baseCurrencyId, baseCurrency.id),
    )
    .leftJoin(
      additionalExpensesCurrency,
      eq(
        calculationSnapshots.additionalExpensesCurrencyId,
        additionalExpensesCurrency.id,
      ),
    )
    .where(inArray(calculations.id, calculationIds));

  for (const row of rows as CalculationCompatRow[]) {
    result.set(row.calculationId, mapCompatibilityCalculation(row));
  }

  return result;
}

export async function listLatestCompatibilityCalculationsByApplicationIds(
  db: Queryable,
  applicationIds: number[],
): Promise<Map<number, CompatibilityCalculationSummary>> {
  const result = new Map<number, CompatibilityCalculationSummary>();
  if (applicationIds.length === 0) {
    return result;
  }

  const { additionalExpensesCurrency, baseCurrency, calculationCurrency, select } =
    buildCompatSelect();

  const rows = await db
    .select(select)
    .from(calculationApplicationLinks)
    .innerJoin(
      calculations,
      eq(calculationApplicationLinks.calculationId, calculations.id),
    )
    .innerJoin(
      calculationSnapshots,
      eq(calculations.currentSnapshotId, calculationSnapshots.id),
    )
    .innerJoin(
      calculationCurrency,
      eq(calculationSnapshots.calculationCurrencyId, calculationCurrency.id),
    )
    .innerJoin(
      baseCurrency,
      eq(calculationSnapshots.baseCurrencyId, baseCurrency.id),
    )
    .leftJoin(
      additionalExpensesCurrency,
      eq(
        calculationSnapshots.additionalExpensesCurrencyId,
        additionalExpensesCurrency.id,
      ),
    )
    .where(
      and(
        inArray(calculationApplicationLinks.applicationId, applicationIds),
        eq(calculations.isActive, true),
      ),
    )
    .orderBy(desc(calculations.createdAt), desc(calculations.id));

  for (const row of rows as CalculationCompatRow[]) {
    const applicationId = row.applicationId;
    if (applicationId == null || result.has(applicationId)) {
      continue;
    }

    result.set(applicationId, mapCompatibilityCalculation(row));
  }

  return result;
}
