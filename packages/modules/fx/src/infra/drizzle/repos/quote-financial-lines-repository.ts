import { eq } from "drizzle-orm";

import { type Database } from "@bedrock/platform/persistence/drizzle";

import type {
  FxDbExecutor,
  FxQuoteFinancialLineWriteModel,
  FxQuoteFinancialLinesRepository,
} from "../../../application/quotes/ports";
import type { FxDbExecutor as Executor } from "../../../application/shared/external-ports";
import { schema } from "../schema";

export function createDrizzleFxQuoteFinancialLinesRepository(
  db: Database,
): FxQuoteFinancialLinesRepository {
  function executorOrDb(executor?: Executor) {
    return executor ?? db;
  }

  async function replaceQuoteFinancialLines(
    input: {
      quoteId: string;
      financialLines: FxQuoteFinancialLineWriteModel[];
    },
    executor?: Executor,
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
    executor?: Executor,
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
