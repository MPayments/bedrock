import { eq } from "drizzle-orm";

import { type Database } from "@bedrock/platform/persistence/drizzle";

import type {
  FxDbExecutor,
  FxQuoteFinancialLinesRepositoryPort,
  FxQuoteFinancialLineWriteModel,
} from "../../../application/ports";
import { schema } from "../schema";

export function createDrizzleFxQuoteFinancialLinesRepository(
  db: Database,
): FxQuoteFinancialLinesRepositoryPort {
  function executorOrDb(executor?: FxDbExecutor) {
    return executor ?? db;
  }

  async function replaceQuoteFinancialLines(
    input: {
      quoteId: string;
      financialLines: FxQuoteFinancialLineWriteModel[];
    },
    executor?: FxDbExecutor,
  ): Promise<void> {
    const dbExecutor = executorOrDb(executor);

    await dbExecutor
      .delete(schema.fxQuoteFinancialLines)
      .where(eq(schema.fxQuoteFinancialLines.quoteId, input.quoteId));

    if (input.financialLines.length === 0) {
      return;
    }

    await dbExecutor
      .insert(schema.fxQuoteFinancialLines)
      .values(input.financialLines);
  }

  async function listQuoteFinancialLines(
    quoteId: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteFinancialLineWriteModel[]> {
    const rows = await executorOrDb(executor)
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
