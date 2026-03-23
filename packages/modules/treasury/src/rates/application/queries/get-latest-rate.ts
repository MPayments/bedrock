import { normalizeCurrency } from "@bedrock/currencies/contracts";
import type { Clock } from "@bedrock/shared/core";

import { RateNotFoundError } from "../../../errors";
import type { CurrenciesPort } from "../../../shared/application/external-ports";
import { RateBook } from "../../domain/rate-book";
import type { RateSourceSyncPort } from "../ports/rate-source-sync.port";
import type {
  RateRowRecord,
} from "../ports/rates.repository";

export class GetLatestRateQuery {
  constructor(
    private readonly now: Clock,
    private readonly currencies: CurrenciesPort,
    private readonly rateSourceSync: RateSourceSyncPort,
  ) {}

  async execute(
    base: string,
    quote: string,
    asOf: Date,
  ): Promise<RateRowRecord> {
    const normalizedBase = normalizeCurrency(base);
    const normalizedQuote = normalizeCurrency(quote);

    const { id: baseCurrencyId } = await this.currencies.findByCode(normalizedBase);
    const { id: quoteCurrencyId } = await this.currencies.findByCode(
      normalizedQuote,
    );
    let rateBook = RateBook.forPair(normalizedBase, normalizedQuote);

    const manualRate = await this.rateSourceSync.getLatestManualRate(
      baseCurrencyId,
      quoteCurrencyId,
      asOf,
    );
    rateBook = rateBook.withManualRate(manualRate ?? null);
    const selectedManualRate = rateBook.selectLatest();
    if (selectedManualRate) {
      return selectedManualRate as RateRowRecord;
    }

    for (const source of rateBook.preferredSources()) {
      await this.rateSourceSync.ensureSourceFresh(source, this.now());
      const rate = await this.rateSourceSync.getLatestRateBySource(
        baseCurrencyId,
        quoteCurrencyId,
        asOf,
        source,
      );
      if (rate) {
        rateBook = rateBook.withSourceRate(source, rate);
        return rateBook.selectLatest() as RateRowRecord;
      }
    }

    throw new RateNotFoundError(
      `Rate not found for ${normalizedBase}/${normalizedQuote} asOf=${asOf.toISOString()}`,
    );
  }
}
