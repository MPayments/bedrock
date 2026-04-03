import type { QuoteRecord } from "../ports";
import type { QuotesRepository } from "../ports/quotes.repository";

export class ExpireQuotesCommand {
  constructor(private readonly quotesRepository: QuotesRepository) {}

  async execute(now: Date): Promise<QuoteRecord[]> {
    return this.quotesRepository.expireOldQuotes(now);
  }
}
