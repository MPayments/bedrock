import { normalizeCurrency } from "@bedrock/foundation/kernel";

import { RateNotFoundError } from "../../errors";
import { type FxServiceContext } from "../../internal/context";
import { type FxRateSource } from "../../sources/types";

export function createRateQueryHandlers(
    context: FxServiceContext,
    deps: {
        ensureSourceFresh: (source: FxRateSource, now?: Date) => Promise<unknown>;
        getLatestManualRate: (baseCurrencyId: string, quoteCurrencyId: string, asOf: Date) => Promise<{
            rateNum: bigint;
            rateDen: bigint;
            source: string;
            asOf: Date;
        } | undefined>;
        getLatestRateBySource: (baseCurrencyId: string, quoteCurrencyId: string, asOf: Date, source: FxRateSource) => Promise<{
            rateNum: bigint;
            rateDen: bigint;
            source: string;
            asOf: Date;
        } | undefined>;
    },
) {
    const { currenciesService } = context;

    async function getLatestRate(base: string, quote: string, asOf: Date) {
        const normalizedBase = normalizeCurrency(base);
        const normalizedQuote = normalizeCurrency(quote);

        const { id: baseCurrencyId } = await currenciesService.findByCode(normalizedBase);
        const { id: quoteCurrencyId } = await currenciesService.findByCode(normalizedQuote);

        const manualRate = await deps.getLatestManualRate(baseCurrencyId, quoteCurrencyId, asOf);
        if (manualRate) {
            return manualRate;
        }

        await deps.ensureSourceFresh("cbr", new Date());
        const cbrRate = await deps.getLatestRateBySource(baseCurrencyId, quoteCurrencyId, asOf, "cbr");
        if (cbrRate) {
            return cbrRate;
        }

        await deps.ensureSourceFresh("investing", new Date());
        const investingRate = await deps.getLatestRateBySource(baseCurrencyId, quoteCurrencyId, asOf, "investing");
        if (investingRate) {
            return investingRate;
        }

        throw new RateNotFoundError(`Rate not found for ${normalizedBase}/${normalizedQuote} asOf=${asOf.toISOString()}`);
    }

    async function getCrossRate(base: string, quote: string, asOf: Date, anchor = "USD") {
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
            if (!(error instanceof RateNotFoundError)) throw error;
        }

        try {
            const inverse = await getLatestRate(quote, base, asOf);
            return { base, quote, rateNum: inverse.rateDen, rateDen: inverse.rateNum };
        } catch (error) {
            if (!(error instanceof RateNotFoundError)) throw error;
        }

        if (base === anchor || quote === anchor) {
            throw new RateNotFoundError(`No direct/inverse rate for ${base}/${quote} and anchor path not possible`);
        }

        const toAnchor = await getLatestRate(base, anchor, asOf).catch(async (error) => {
            if (!(error instanceof RateNotFoundError)) throw error;
            const inv = await getLatestRate(anchor, base, asOf);
            return { rateNum: inv.rateDen, rateDen: inv.rateNum };
        });

        const fromAnchor = await getLatestRate(anchor, quote, asOf).catch(async (error) => {
            if (!(error instanceof RateNotFoundError)) throw error;
            const inv = await getLatestRate(quote, anchor, asOf);
            return { rateNum: inv.rateDen, rateDen: inv.rateNum };
        });

        return {
            base,
            quote,
            rateNum: toAnchor.rateNum * fromAnchor.rateNum,
            rateDen: toAnchor.rateDen * fromAnchor.rateDen,
        };
    }

    return {
        getLatestRate,
        getCrossRate,
    };
}
