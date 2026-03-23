import { ValidationError } from "@bedrock/shared/core/errors";
import { isUuidLike } from "@bedrock/shared/core/uuid";

import { NotFoundError } from "../../../errors";
import type { FeeComponent } from "../../../fees/application/contracts";
import {
  listCurrencyCodesById,
  listPairCurrencyCodesById,
  withPairCurrencyCode,
  withPairCurrencyCodes,
} from "../../../shared/application/currency-codes";
import type { CurrenciesPort } from "../../../shared/application/external-ports";
import {
  GetQuoteDetailsInputSchema,
  type GetQuoteDetailsInput,
} from "../contracts/queries";
import type { QuoteDetailsRecord, QuoteRecord } from "../ports";
import type { QuoteFeeComponentsRepository } from "../ports/quote-fee-components.repository";
import type { QuoteFinancialLinesRepository } from "../ports/quote-financial-lines.repository";
import type { QuotesRepository } from "../ports/quotes.repository";

export class GetQuoteDetailsQuery {
  constructor(
    private readonly currencies: CurrenciesPort,
    private readonly quoteFeeComponentsRepository: QuoteFeeComponentsRepository,
    private readonly quoteFinancialLinesRepository: QuoteFinancialLinesRepository,
    private readonly quotesRepository: QuotesRepository,
  ) {}

  async execute(input: GetQuoteDetailsInput): Promise<QuoteDetailsRecord> {
    const validated = GetQuoteDetailsInputSchema.parse(input);
    const quote = await this.resolveQuoteByRef(validated.quoteRef);

    if (!quote) {
      throw new NotFoundError("Quote", validated.quoteRef);
    }

    const [legs, feeComponentRows, financialLineRows] = await Promise.all([
      this.quotesRepository.listQuoteLegs(quote.id),
      this.quoteFeeComponentsRepository.listQuoteFeeComponents(quote.id),
      this.quoteFinancialLinesRepository.listQuoteFinancialLines(quote.id),
    ]);
    const pairCurrencyCodeById = await listPairCurrencyCodesById(
      this.currencies,
      [quote, ...legs],
    );
    const codeById = await listCurrencyCodesById(this.currencies, [
      ...pairCurrencyCodeById.keys(),
      ...feeComponentRows.map((row) => row.currencyId),
      ...financialLineRows.map((row) => row.currencyId),
    ]);
    const enrichedQuote = withPairCurrencyCode(quote, pairCurrencyCodeById);

    const financialLines = financialLineRows.map((row) => ({
      id: `quote_financial_line:${row.quoteId}:${row.idx}`,
      bucket: row.bucket,
      currency: codeById.get(row.currencyId)!,
      amountMinor: row.amountMinor,
      source: row.source,
      settlementMode: row.settlementMode,
      memo: row.memo ?? undefined,
      metadata: row.metadata ?? undefined,
    }));

    const feeComponents: FeeComponent[] = feeComponentRows
      .slice()
      .sort((left, right) => left.idx - right.idx)
      .map((row) => ({
        id: `quote_component:${row.quoteId}:${row.idx}`,
        ruleId: row.ruleId ?? undefined,
        kind: row.kind,
        currency: codeById.get(row.currencyId)!,
        amountMinor: row.amountMinor,
        source: row.source,
        settlementMode: row.settlementMode,
        memo: row.memo ?? undefined,
        metadata: row.metadata ?? undefined,
      }));

    return {
      quote: enrichedQuote,
      legs: withPairCurrencyCodes(legs, pairCurrencyCodeById),
      feeComponents,
      financialLines,
      pricingTrace: (enrichedQuote.pricingTrace ?? {}) as Record<string, unknown>,
    };
  }

  private async resolveQuoteByRef(
    quoteRef: string,
  ): Promise<QuoteRecord | undefined> {
    if (isUuidLike(quoteRef)) {
      const [byId, byIdempotency] = await Promise.all([
        this.quotesRepository.findQuoteById(quoteRef),
        this.quotesRepository.findQuoteByIdempotencyKey(quoteRef),
      ]);

      if (byId && byIdempotency && byId.id !== byIdempotency.id) {
        throw new ValidationError(
          `quoteRef ${quoteRef} is ambiguous between quote ID and idempotency key`,
        );
      }

      return byId ?? byIdempotency;
    }

    const byIdempotency =
      await this.quotesRepository.findQuoteByIdempotencyKey(quoteRef);

    return byIdempotency;
  }
}
