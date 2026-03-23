import type { QuotesRepository } from "../ports/quotes.repository";

export class ExpireQuotesCommand {
  constructor(private readonly quotesRepository: QuotesRepository) {}

  async execute(now: Date): Promise<void> {
    await this.quotesRepository.expireOldQuotes(now);
  }
}
