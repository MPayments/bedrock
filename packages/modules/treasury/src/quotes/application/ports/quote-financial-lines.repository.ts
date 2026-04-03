import type { FinancialLine } from "@bedrock/documents/contracts";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

export interface QuoteFinancialLineWriteModel {
  quoteId: string;
  idx: number;
  bucket: FinancialLine["bucket"];
  currencyId: string;
  amountMinor: bigint;
  source: FinancialLine["source"];
  settlementMode: NonNullable<FinancialLine["settlementMode"]>;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface ReplaceQuoteFinancialLinesInput {
  quoteId: string;
  financialLines: QuoteFinancialLineWriteModel[];
}

export interface QuoteFinancialLinesRepository {
  replaceQuoteFinancialLines(
    input: ReplaceQuoteFinancialLinesInput,
    tx?: PersistenceSession,
  ): Promise<void>;
  listQuoteFinancialLines(
    quoteId: string,
    tx?: PersistenceSession,
  ): Promise<QuoteFinancialLineWriteModel[]>;
}
