import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsCalculations } from "../../../infra/drizzle/schema";
import type { CreateCalculationInput } from "../../application/contracts/commands";
import type { Calculation } from "../../application/contracts/dto";
import type { CalculationStore } from "../../application/ports/calculation.store";

export class DrizzleCalculationStore implements CalculationStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Calculation | null> {
    const [row] = await this.db
      .select()
      .from(opsCalculations)
      .where(eq(opsCalculations.id, id))
      .limit(1);
    return (row as unknown as Calculation) ?? null;
  }

  async create(input: CreateCalculationInput): Promise<Calculation> {
    const [created] = await this.db
      .insert(opsCalculations)
      .values({
        applicationId: input.applicationId,
        currencyCode: input.currencyCode,
        originalAmount: input.originalAmount,
        feePercentage: input.feePercentage,
        feeAmount: input.feeAmount,
        totalAmount: input.totalAmount,
        rateSource: input.rateSource,
        rate: input.rate,
        additionalExpensesCurrencyCode:
          input.additionalExpensesCurrencyCode ?? null,
        additionalExpenses: input.additionalExpenses,
        baseCurrencyCode: input.baseCurrencyCode,
        feeAmountInBase: input.feeAmountInBase,
        totalInBase: input.totalInBase,
        additionalExpensesInBase: input.additionalExpensesInBase,
        totalWithExpensesInBase: input.totalWithExpensesInBase,
        calculationTimestamp: input.calculationTimestamp,
        status: "active",
      })
      .returning();
    return created! as unknown as Calculation;
  }

  async updateStatus(
    id: number,
    status: string,
  ): Promise<Calculation | null> {
    const [updated] = await this.db
      .update(opsCalculations)
      .set({ status })
      .where(eq(opsCalculations.id, id))
      .returning();
    return (updated as unknown as Calculation) ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .delete(opsCalculations)
      .where(eq(opsCalculations.id, id))
      .returning({ id: opsCalculations.id });
    return Boolean(deleted);
  }
}
