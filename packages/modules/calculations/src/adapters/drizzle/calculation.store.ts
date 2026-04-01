import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  calculationLines,
  calculations,
  calculationSnapshots,
} from "./schema";
import type {
  CalculationStore,
  CreateCalculationLineStoredInput,
  CreateCalculationRootInput,
  CreateCalculationSnapshotInput,
} from "../../application/ports/calculation.store";

export class DrizzleCalculationStore implements CalculationStore {
  constructor(private readonly db: Queryable) {}

  async createCalculationRoot(input: CreateCalculationRootInput): Promise<void> {
    await this.db.insert(calculations).values({
      id: input.id,
      isActive: input.isActive ?? true,
      currentSnapshotId: null,
    });
  }

  async createCalculationSnapshot(
    input: CreateCalculationSnapshotInput,
  ): Promise<void> {
    await this.db.insert(calculationSnapshots).values({
      id: input.id,
      calculationId: input.calculationId,
      snapshotNumber: input.snapshotNumber,
      calculationCurrencyId: input.calculationCurrencyId,
      originalAmountMinor: input.originalAmountMinor,
      feeBps: input.feeBps,
      feeAmountMinor: input.feeAmountMinor,
      totalAmountMinor: input.totalAmountMinor,
      baseCurrencyId: input.baseCurrencyId,
      feeAmountInBaseMinor: input.feeAmountInBaseMinor,
      totalInBaseMinor: input.totalInBaseMinor,
      additionalExpensesCurrencyId: input.additionalExpensesCurrencyId,
      additionalExpensesAmountMinor: input.additionalExpensesAmountMinor,
      additionalExpensesInBaseMinor: input.additionalExpensesInBaseMinor,
      totalWithExpensesInBaseMinor: input.totalWithExpensesInBaseMinor,
      rateSource: input.rateSource,
      rateNum: input.rateNum,
      rateDen: input.rateDen,
      additionalExpensesRateSource: input.additionalExpensesRateSource,
      additionalExpensesRateNum: input.additionalExpensesRateNum,
      additionalExpensesRateDen: input.additionalExpensesRateDen,
      calculationTimestamp: input.calculationTimestamp,
      fxQuoteId: input.fxQuoteId,
      quoteSnapshot: input.quoteSnapshot,
    });
  }

  async createCalculationLines(
    input: CreateCalculationLineStoredInput[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db.insert(calculationLines).values(
      input.map((line) => ({
        id: line.id,
        calculationSnapshotId: line.calculationSnapshotId,
        idx: line.idx,
        kind: line.kind,
        currencyId: line.currencyId,
        amountMinor: line.amountMinor,
      })),
    );
  }

  async setCurrentSnapshot(input: {
    calculationId: string;
    currentSnapshotId: string;
  }): Promise<void> {
    await this.db
      .update(calculations)
      .set({
        currentSnapshotId: input.currentSnapshotId,
        updatedAt: sql`now()`,
      })
      .where(eq(calculations.id, input.calculationId));
  }

  async setActive(input: {
    calculationId: string;
    isActive: boolean;
  }): Promise<void> {
    await this.db
      .update(calculations)
      .set({
        isActive: input.isActive,
        updatedAt: sql`now()`,
      })
      .where(eq(calculations.id, input.calculationId));
  }
}
