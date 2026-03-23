import { eq } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { schema } from "../../../schema";
import type {
  QuoteFinancialLineWriteModel,
  QuoteFinancialLinesRepository,
  ReplaceQuoteFinancialLinesInput,
} from "../../application/ports";

export class DrizzleTreasuryQuoteFinancialLinesRepository
  implements QuoteFinancialLinesRepository
{
  constructor(private readonly db: Queryable) {}

  async replaceQuoteFinancialLines(
    input: ReplaceQuoteFinancialLinesInput,
    tx?: PersistenceSession,
  ): Promise<void> {
    const database = (tx as Transaction | undefined) ?? this.db;

    await database
      .delete(schema.fxQuoteFinancialLines)
      .where(eq(schema.fxQuoteFinancialLines.quoteId, input.quoteId));

    if (input.financialLines.length === 0) {
      return;
    }

    await database.insert(schema.fxQuoteFinancialLines).values(input.financialLines);
  }

  async listQuoteFinancialLines(
    quoteId: string,
    tx?: PersistenceSession,
  ): Promise<QuoteFinancialLineWriteModel[]> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const rows = await database
      .select()
      .from(schema.fxQuoteFinancialLines)
      .where(eq(schema.fxQuoteFinancialLines.quoteId, quoteId))
      .orderBy(schema.fxQuoteFinancialLines.idx);

    return rows as QuoteFinancialLineWriteModel[];
  }
}
