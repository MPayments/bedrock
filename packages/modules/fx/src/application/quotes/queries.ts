import { type PaginatedList } from "@bedrock/shared/core/pagination";
import { ValidationError } from "@bedrock/shared/core/errors";
import { isUuidLike } from "@bedrock/shared/core/uuid";

import { NotFoundError } from "../../errors";
import type {
  FxQuoteDetailsRecord,
  FxQuoteLegRecord,
  FxQuoteRecord,
} from "../ports";
import type { FxServiceContext } from "../shared/context";
import {
  type GetQuoteDetailsInput,
  type ListFxQuotesQuery,
  validateGetQuoteDetailsInput,
  validateListFxQuotesQuery,
} from "../validation";

export function createFxQuoteQueryHandlers(context: FxServiceContext) {
  const {
    currenciesService,
    feesService,
    quotesRepository,
    quoteFinancialLinesRepository,
  } = context;

  async function resolveCurrencyCodeMap(quotes: FxQuoteRecord[]) {
    const uniqueCurrencyIds = [
      ...new Set(
        quotes.flatMap((quote) => [quote.fromCurrencyId, quote.toCurrencyId]),
      ),
    ];
    const codeById = new Map<string, string>();

    await Promise.all(
      uniqueCurrencyIds.map(async (id) => {
        const currency = await currenciesService.findById(id);
        codeById.set(id, currency.code);
      }),
    );

    return codeById;
  }

  async function withQuoteCurrencyCodes(quote: FxQuoteRecord) {
    const codeById = await resolveCurrencyCodeMap([quote]);
    return {
      ...quote,
      fromCurrency: codeById.get(quote.fromCurrencyId)!,
      toCurrency: codeById.get(quote.toCurrencyId)!,
    } satisfies FxQuoteRecord;
  }

  async function withQuotesCurrencyCodes(quotes: FxQuoteRecord[]) {
    if (quotes.length === 0) {
      return [];
    }

    const codeById = await resolveCurrencyCodeMap(quotes);
    return quotes.map((quote) => ({
      ...quote,
      fromCurrency: codeById.get(quote.fromCurrencyId)!,
      toCurrency: codeById.get(quote.toCurrencyId)!,
    })) satisfies FxQuoteRecord[];
  }

  async function withLegCurrencyCodes(legs: FxQuoteLegRecord[]) {
    const uniqueCurrencyIds = [
      ...new Set(legs.flatMap((leg) => [leg.fromCurrencyId, leg.toCurrencyId])),
    ];
    const codeById = new Map<string, string>();

    await Promise.all(
      uniqueCurrencyIds.map(async (id) => {
        const currency = await currenciesService.findById(id);
        codeById.set(id, currency.code);
      }),
    );

    return legs.map((leg) => ({
      ...leg,
      fromCurrency: codeById.get(leg.fromCurrencyId)!,
      toCurrency: codeById.get(leg.toCurrencyId)!,
    })) satisfies FxQuoteLegRecord[];
  }

  async function resolveQuoteByRef(
    quoteRef: string,
  ): Promise<FxQuoteRecord | undefined> {
    if (isUuidLike(quoteRef)) {
      const [byId, byIdempotency] = await Promise.all([
        quotesRepository.findQuoteById(quoteRef),
        quotesRepository.findQuoteByIdempotencyKey(quoteRef),
      ]);

      if (byId && byIdempotency && byId.id !== byIdempotency.id) {
        throw new ValidationError(
          `quoteRef ${quoteRef} is ambiguous between quote ID and idempotency key`,
        );
      }

      const resolved = byId ?? byIdempotency;
      return resolved ? withQuoteCurrencyCodes(resolved) : undefined;
    }

    const byIdempotency =
      await quotesRepository.findQuoteByIdempotencyKey(quoteRef);
    return byIdempotency ? withQuoteCurrencyCodes(byIdempotency) : undefined;
  }

  async function getQuoteDetails(
    input: GetQuoteDetailsInput,
  ): Promise<FxQuoteDetailsRecord> {
    const validated = validateGetQuoteDetailsInput(input);
    const quote = await resolveQuoteByRef(validated.quoteRef);

    if (!quote) {
      throw new NotFoundError("Quote", validated.quoteRef);
    }

    const [legs, feeComponents, financialLineRows] = await Promise.all([
      quotesRepository.listQuoteLegs(quote.id),
      feesService.getQuoteFeeComponents({ quoteId: quote.id }),
      quoteFinancialLinesRepository.listQuoteFinancialLines(quote.id),
    ]);

    const financialLines = await Promise.all(
      financialLineRows.map(async (row) => {
        const currency = await currenciesService.findById(row.currencyId);
        return {
          id: `quote_financial_line:${row.quoteId}:${row.idx}`,
          bucket: row.bucket,
          currency: currency.code,
          amountMinor: row.amountMinor,
          source: row.source,
          settlementMode: row.settlementMode,
          memo: row.memo ?? undefined,
          metadata: row.metadata ?? undefined,
        };
      }),
    );

    return {
      quote,
      legs: await withLegCurrencyCodes(legs),
      feeComponents,
      financialLines,
      pricingTrace: (quote.pricingTrace ?? {}) as Record<string, unknown>,
    };
  }

  async function listQuotes(
    input?: ListFxQuotesQuery,
  ): Promise<PaginatedList<FxQuoteRecord>> {
    const validated = validateListFxQuotesQuery(input ?? {});
    const { rows, total } = await quotesRepository.listQuotes({
      limit: validated.limit,
      offset: validated.offset,
      sortBy: validated.sortBy,
      sortOrder: validated.sortOrder,
      idempotencyKey: validated.idempotencyKey,
      status: validated.status,
      pricingMode: validated.pricingMode,
    });

    return {
      data: await withQuotesCurrencyCodes(rows),
      total,
      limit: validated.limit,
      offset: validated.offset,
    };
  }

  return {
    listQuotes,
    getQuoteDetails,
    withQuoteCurrencyCodes,
  };
}
