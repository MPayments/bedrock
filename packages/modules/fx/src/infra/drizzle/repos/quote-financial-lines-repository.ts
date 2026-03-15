import { eq } from "drizzle-orm";

import { type Database } from "@bedrock/platform/persistence/drizzle";
import type { Transaction } from "@bedrock/platform/persistence";

import type {
  FxQuoteFinancialLineWriteModel,
  FxQuoteFinancialLinesRepository,
} from "../../../application/quotes/ports";
import { schema } from "../schema";

export function createDrizzleFxQuoteFinancialLinesRepository(
  db: Database,
): FxQuoteFinancialLinesRepository {
  async function replaceQuoteFinancialLines(
    input: {
      quoteId: string;
      financialLines: FxQuoteFinancialLineWriteModel[];
    },
    tx?: Transaction,
  ): Promise<void> {
    const database = tx ?? db;

    await database
      .delete(schema.fxQuoteFinancialLines)
      .where(eq(schema.fxQuoteFinancialLines.quoteId, input.quoteId));

    if (input.financialLines.length === 0) {
      return;
    }

    await database
      .insert(schema.fxQuoteFinancialLines)
      .values(input.financialLines);
  }

  async function listQuoteFinancialLines(
    quoteId: string,
    tx?: Transaction,
  ): Promise<FxQuoteFinancialLineWriteModel[]> {
    const database = tx ?? db;
    const rows = await database
      .select()
      .from(schema.fxQuoteFinancialLines)
      .where(eq(schema.fxQuoteFinancialLines.quoteId, quoteId))
      .orderBy(schema.fxQuoteFinancialLines.idx);

    return rows as FxQuoteFinancialLineWriteModel[];
  }

  return {
    replaceQuoteFinancialLines,
    listQuoteFinancialLines,
  };
}
