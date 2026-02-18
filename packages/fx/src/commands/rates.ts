import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "@bedrock/db/schema";
import { normalizeCurrency } from "@bedrock/kernel";

import { RateNotFoundError } from "../errors";
import { type FxServiceContext } from "../internal/context";
import { type SetManualRateInput, validateSetManualRateInput } from "../validation";

export function createRateHandlers(context: FxServiceContext) {
    const { db, currenciesService } = context;

    async function setManualRate(input: SetManualRateInput) {
        const validated = validateSetManualRateInput(input);

        const { id: baseCurrencyId } = await currenciesService.findByCode(validated.base);
        const { id: quoteCurrencyId } = await currenciesService.findByCode(validated.quote);

        await db.insert(schema.fxRates).values({
            baseCurrencyId,
            quoteCurrencyId,
            rateNum: validated.rateNum,
            rateDen: validated.rateDen,
            asOf: validated.asOf,
            source: validated.source ?? "manual",
        });
    }

    async function getLatestRate(base: string, quote: string, asOf: Date) {
        base = normalizeCurrency(base);
        quote = normalizeCurrency(quote);

        const { id: baseCurrencyId } = await currenciesService.findByCode(base);
        const { id: quoteCurrencyId } = await currenciesService.findByCode(quote);

        const rows = await db
            .select()
            .from(schema.fxRates)
            .where(and(
                eq(schema.fxRates.baseCurrencyId, baseCurrencyId),
                eq(schema.fxRates.quoteCurrencyId, quoteCurrencyId),
                sql`${schema.fxRates.asOf} <= ${asOf}`
            ))
            .orderBy(desc(schema.fxRates.asOf))
            .limit(1);

        if (!rows.length) throw new RateNotFoundError(`Rate not found for ${base}/${quote} asOf=${asOf.toISOString()}`);
        return rows[0]!;
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
        } catch {
            // fallthrough
        }

        try {
            const inverse = await getLatestRate(quote, base, asOf);
            return { base, quote, rateNum: inverse.rateDen, rateDen: inverse.rateNum };
        } catch {
            // fallthrough
        }

        if (base === anchor || quote === anchor) {
            throw new RateNotFoundError(`No direct/inverse rate for ${base}/${quote} and anchor path not possible`);
        }

        const toAnchor = await getLatestRate(base, anchor, asOf).catch(async () => {
            const inv = await getLatestRate(anchor, base, asOf);
            return { rateNum: inv.rateDen, rateDen: inv.rateNum };
        });

        const fromAnchor = await getLatestRate(anchor, quote, asOf).catch(async () => {
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

    async function expireOldQuotes(now: Date) {
        await db.execute(sql`
      UPDATE ${schema.fxQuotes}
      SET status = 'expired'
      WHERE status = 'active'
        AND expires_at <= ${now}
    `);
    }

    return {
        setManualRate,
        getLatestRate,
        getCrossRate,
        expireOldQuotes,
    };
}
