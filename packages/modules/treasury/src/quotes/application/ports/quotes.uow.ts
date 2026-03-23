import type {
  QuoteFeeComponentSnapshotRecord,
  ReplaceQuoteFeeComponentsInput,
} from "./quote-fee-components.repository";
import type {
  QuoteFinancialLineWriteModel,
  ReplaceQuoteFinancialLinesInput,
} from "./quote-financial-lines.repository";
import type {
  QuoteLegRecord,
  QuoteLegWriteModel,
  QuoteRecord,
  QuoteWriteModel,
} from "./quotes.repository";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface QuotesCommandRepository {
  insertQuote(input: QuoteWriteModel): Promise<QuoteRecord | null>;
  insertQuoteLegs(input: QuoteLegWriteModel[]): Promise<void>;
  findQuoteByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<QuoteRecord | undefined>;
  listQuoteLegs(quoteId: string): Promise<QuoteLegRecord[]>;
}

export interface QuoteFeeComponentsCommandStore {
  replaceQuoteFeeComponents(input: ReplaceQuoteFeeComponentsInput): Promise<void>;
  listQuoteFeeComponents(
    quoteId: string,
  ): Promise<QuoteFeeComponentSnapshotRecord[]>;
}

export interface QuoteFinancialLinesCommandStore {
  replaceQuoteFinancialLines(input: ReplaceQuoteFinancialLinesInput): Promise<void>;
  listQuoteFinancialLines(
    quoteId: string,
  ): Promise<QuoteFinancialLineWriteModel[]>;
}

export interface QuotesCommandTx {
  quotes: QuotesCommandRepository;
  quoteFeeComponents: QuoteFeeComponentsCommandStore;
  quoteFinancialLines: QuoteFinancialLinesCommandStore;
}

export type QuotesCommandUnitOfWork = UnitOfWork<QuotesCommandTx>;
