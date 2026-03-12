import { sql } from "drizzle-orm";

import { schema as currenciesSchema } from "@bedrock/app/currencies/schema";
import { schema as fxSchema } from "@bedrock/app/fx/schema";

import { type FxServiceContext } from "../../internal/context";
import { getSourceOrder } from "../../internal/source-priority";
import { type FxRateSource } from "../../sources/types";

const schema = {
    ...fxSchema,
    ...currenciesSchema,
};

export interface SourceRateView {
    source: string;
    rateNum: bigint;
    rateDen: bigint;
    asOf: Date;
    change: number | null;
    changePercent: number | null;
}

export interface RatePairView {
    baseCurrencyCode: string;
    quoteCurrencyCode: string;
    bestRate: SourceRateView;
    rates: SourceRateView[];
}

function computeRate(num: bigint, den: bigint): number {
    return Number(num) / Number(den);
}

export function createListPairsHandler(context: FxServiceContext) {
    const { db } = context;

    async function listPairs(): Promise<RatePairView[]> {
        const fr = schema.fxRates;
        const curr = schema.currencies;

        const rows = await db.execute<{
            source: string;
            rate_num: string;
            rate_den: string;
            as_of: string;
            base_code: string;
            quote_code: string;
            rn: string;
        }>(sql`
            WITH ranked AS (
                SELECT
                    ${fr.source} AS source,
                    ${fr.baseCurrencyId} AS base_currency_id,
                    ${fr.quoteCurrencyId} AS quote_currency_id,
                    ${fr.rateNum} AS rate_num,
                    ${fr.rateDen} AS rate_den,
                    ${fr.asOf} AS as_of,
                    ROW_NUMBER() OVER (
                        PARTITION BY ${fr.source}, ${fr.baseCurrencyId}, ${fr.quoteCurrencyId}
                        ORDER BY ${fr.asOf} DESC, ${fr.createdAt} DESC
                    ) AS rn
                FROM ${fr}
            )
            SELECT
                r.source,
                r.rate_num::text AS rate_num,
                r.rate_den::text AS rate_den,
                r.as_of,
                bc.code AS base_code,
                qc.code AS quote_code,
                r.rn::text AS rn
            FROM ranked r
            JOIN ${curr} bc ON bc.id = r.base_currency_id
            JOIN ${curr} qc ON qc.id = r.quote_currency_id
            WHERE r.rn <= 2
            ORDER BY base_code, quote_code, r.source, r.rn
        `);

        const grouped = new Map<string, Map<string, { current: typeof rows.rows[number]; previous?: typeof rows.rows[number] }>>();

        for (const row of rows.rows) {
            const pairKey = `${row.base_code}|${row.quote_code}`;
            if (!grouped.has(pairKey)) {
                grouped.set(pairKey, new Map());
            }
            const sourceMap = grouped.get(pairKey)!;
            const rn = Number(row.rn);

            if (!sourceMap.has(row.source)) {
                sourceMap.set(row.source, { current: row });
            }

            const entry = sourceMap.get(row.source)!;
            if (rn === 1) {
                entry.current = row;
            } else if (rn === 2) {
                entry.previous = row;
            }
        }

        const result: RatePairView[] = [];

        for (const [pairKey, sourceMap] of grouped) {
            const [baseCode, quoteCode] = pairKey.split("|");
            const rates: SourceRateView[] = [];
            const order = getSourceOrder(baseCode!, quoteCode!);

            for (const [, entry] of sourceMap) {
                const rateNum = BigInt(entry.current.rate_num);
                const rateDen = BigInt(entry.current.rate_den);
                const currentDecimal = computeRate(rateNum, rateDen);

                let change: number | null = null;
                let changePercent: number | null = null;

                if (entry.previous) {
                    const prevDecimal = computeRate(BigInt(entry.previous.rate_num), BigInt(entry.previous.rate_den));
                    if (prevDecimal !== 0) {
                        change = currentDecimal - prevDecimal;
                        changePercent = (change / prevDecimal) * 100;
                    }
                }

                rates.push({
                    source: entry.current.source,
                    rateNum,
                    rateDen,
                    asOf: new Date(entry.current.as_of),
                    change,
                    changePercent,
                });
            }

            for (const rate of rates) {
                if (rate.source === "manual") {
                    continue;
                }

                if (!order.includes(rate.source as FxRateSource)) {
                    throw new Error(`Unknown FX rate source: ${rate.source}`);
                }
            }

            rates.sort((a, b) => {
                if (a.source === "manual") return -1;
                if (b.source === "manual") return 1;
                return order.indexOf(a.source as FxRateSource) - order.indexOf(b.source as FxRateSource);
            });

            result.push({
                baseCurrencyCode: baseCode!,
                quoteCurrencyCode: quoteCode!,
                bestRate: rates[0]!,
                rates,
            });
        }

        result.sort((a, b) => {
            const cmp = a.baseCurrencyCode.localeCompare(b.baseCurrencyCode);
            return cmp !== 0 ? cmp : a.quoteCurrencyCode.localeCompare(b.quoteCurrencyCode);
        });

        return result;
    }

    return { listPairs };
}
