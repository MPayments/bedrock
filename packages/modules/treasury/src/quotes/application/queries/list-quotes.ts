import { type PaginatedList } from "@bedrock/shared/core/pagination";

import { enrichPairCurrencyRecords } from "../../../shared/application/currency-codes";
import type { CurrenciesPort } from "../../../shared/application/external-ports";
import {
  ListQuotesQuerySchema,
  type ListQuotesQuery as ListQuotesQueryInput,
} from "../contracts/queries";
import type { QuoteRecord } from "../ports";
import type { QuotesRepository } from "../ports/quotes.repository";

export class ListQuotesQuery {
  constructor(
    private readonly currencies: CurrenciesPort,
    private readonly quotesRepository: QuotesRepository,
  ) {}

  async execute(
    input?: ListQuotesQueryInput,
  ): Promise<PaginatedList<QuoteRecord>> {
    const validated = ListQuotesQuerySchema.parse(input ?? {});
    const { rows, total } = await this.quotesRepository.listQuotes({
      limit: validated.limit,
      offset: validated.offset,
      sortBy: validated.sortBy,
      sortOrder: validated.sortOrder,
      idempotencyKey: validated.idempotencyKey,
      status: validated.status,
      pricingMode: validated.pricingMode,
    });
    return {
      data: await enrichPairCurrencyRecords(this.currencies, rows),
      total,
      limit: validated.limit,
      offset: validated.offset,
    };
  }
}
