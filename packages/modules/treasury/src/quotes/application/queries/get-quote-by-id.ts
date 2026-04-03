import type { QuoteRecord, QuotesRepository } from "../ports";

export class GetQuoteByIdQuery {
  constructor(private readonly quotesRepository: QuotesRepository) {}

  async execute(id: string): Promise<QuoteRecord | null> {
    return (await this.quotesRepository.findQuoteById(id)) ?? null;
  }
}
