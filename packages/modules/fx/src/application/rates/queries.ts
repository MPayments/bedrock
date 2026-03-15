import { normalizeCurrency } from "@bedrock/currencies/catalog";

import { RateNotFoundError } from "../../errors";
import { getSourceOrder } from "../../domain/source-priority";
import type {
  CrossRate,
  FxRateSourceStatus,
  RateHistoryPoint,
  RatePairView,
  RateRowRecord,
} from "./ports";
import type { FxRateSource } from "../shared/external-ports";
import type { FxServiceContext } from "../shared/context";

export function createRateQueryHandlers(
  context: FxServiceContext,
  deps: {
    ensureSourceFresh: (
      source: FxRateSource,
      now?: Date,
    ) => Promise<FxRateSourceStatus>;
    getLatestManualRate: (
      baseCurrencyId: string,
      quoteCurrencyId: string,
      asOf: Date,
    ) => Promise<RateRowRecord | undefined>;
    getLatestRateBySource: (
      baseCurrencyId: string,
      quoteCurrencyId: string,
      asOf: Date,
      source: FxRateSource,
    ) => Promise<RateRowRecord | undefined>;
    getRateSourceStatuses: (now?: Date) => Promise<FxRateSourceStatus[]>;
  },
) {
  const { currenciesService, ratesRepository } = context;

  async function getLatestRate(base: string, quote: string, asOf: Date) {
    const normalizedBase = normalizeCurrency(base);
    const normalizedQuote = normalizeCurrency(quote);

    const { id: baseCurrencyId } = await currenciesService.findByCode(
      normalizedBase,
    );
    const { id: quoteCurrencyId } = await currenciesService.findByCode(
      normalizedQuote,
    );

    const manualRate = await deps.getLatestManualRate(
      baseCurrencyId,
      quoteCurrencyId,
      asOf,
    );
    if (manualRate) {
      return manualRate;
    }

    const sourceOrder = getSourceOrder(normalizedBase, normalizedQuote);
    for (const source of sourceOrder) {
      await deps.ensureSourceFresh(source, new Date());
      const rate = await deps.getLatestRateBySource(
        baseCurrencyId,
        quoteCurrencyId,
        asOf,
        source,
      );
      if (rate) {
        return rate;
      }
    }

    throw new RateNotFoundError(
      `Rate not found for ${normalizedBase}/${normalizedQuote} asOf=${asOf.toISOString()}`,
    );
  }

  async function getCrossRate(
    base: string,
    quote: string,
    asOf: Date,
    anchor = "USD",
  ): Promise<CrossRate> {
    base = normalizeCurrency(base);
    quote = normalizeCurrency(quote);
    anchor = normalizeCurrency(anchor);

    if (base === quote) {
      return {
        base,
        quote,
        rateNum: 1n,
        rateDen: 1n,
      };
    }

    try {
      const direct = await getLatestRate(base, quote, asOf);
      return { base, quote, rateNum: direct.rateNum, rateDen: direct.rateDen };
    } catch (error) {
      if (!(error instanceof RateNotFoundError)) {
        throw error;
      }
    }

    try {
      const inverse = await getLatestRate(quote, base, asOf);
      return {
        base,
        quote,
        rateNum: inverse.rateDen,
        rateDen: inverse.rateNum,
      };
    } catch (error) {
      if (!(error instanceof RateNotFoundError)) {
        throw error;
      }
    }

    if (base === anchor || quote === anchor) {
      throw new RateNotFoundError(
        `No direct/inverse rate for ${base}/${quote} and anchor path not possible`,
      );
    }

    const toAnchor = await getLatestRate(base, anchor, asOf).catch(
      async (error) => {
        if (!(error instanceof RateNotFoundError)) {
          throw error;
        }
        const inverse = await getLatestRate(anchor, base, asOf);
        return { rateNum: inverse.rateDen, rateDen: inverse.rateNum };
      },
    );

    const fromAnchor = await getLatestRate(anchor, quote, asOf).catch(
      async (error) => {
        if (!(error instanceof RateNotFoundError)) {
          throw error;
        }
        const inverse = await getLatestRate(quote, anchor, asOf);
        return { rateNum: inverse.rateDen, rateDen: inverse.rateNum };
      },
    );

    return {
      base,
      quote,
      rateNum: toAnchor.rateNum * fromAnchor.rateNum,
      rateDen: toAnchor.rateDen * fromAnchor.rateDen,
    };
  }

  async function listPairs(): Promise<RatePairView[]> {
    return ratesRepository.listPairs();
  }

  async function getRateHistory(input: {
    base: string;
    quote: string;
    limit?: number;
    from?: Date;
  }): Promise<RateHistoryPoint[]> {
    return ratesRepository.getRateHistory(input);
  }

  async function getRateSourceStatuses(now = new Date()) {
    return deps.getRateSourceStatuses(now);
  }

  return {
    getLatestRate,
    getCrossRate,
    listPairs,
    getRateHistory,
    getRateSourceStatuses,
  };
}
