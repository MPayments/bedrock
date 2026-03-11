import { sql } from "drizzle-orm";

import { schema as currenciesSchema } from "@multihansa/assets/schema";

import { schema as fxSchema } from "@multihansa/treasury/fx/schema";

import { type FxServiceContext } from "../../context";

export interface RateHistoryPoint {
    source: string;
    rateNum: bigint;
    rateDen: bigint;
    asOf: Date;
}

export interface GetRateHistoryInput {
    base: string;
    quote: string;
    limit?: number;
    from?: Date;
}

export function createGetRateHistoryHandler(context: FxServiceContext) {
    const { db } = context;
    const schema = {
        ...fxSchema,
        ...currenciesSchema,
    };

    async function getRateHistory(input: GetRateHistoryInput): Promise<RateHistoryPoint[]> {
        const { base, quote, limit = 100, from } = input;
        const fr = schema.fxRates;
        const curr = schema.currencies;

        const rows = await db.execute<{
            source: string;
            rate_num: string;
            rate_den: string;
            as_of: string;
        }>(sql`
            SELECT
                r.source,
                r.rate_num::text AS rate_num,
                r.rate_den::text AS rate_den,
                r.as_of
            FROM ${fr} r
            JOIN ${curr} bc ON bc.id = r.base_currency_id
            JOIN ${curr} qc ON qc.id = r.quote_currency_id
            WHERE bc.code = ${base.trim().toUpperCase()}
              AND qc.code = ${quote.trim().toUpperCase()}
              AND (${from ?? null}::timestamptz IS NULL OR r.as_of >= ${from ?? null}::timestamptz)
            ORDER BY r.as_of ASC
            LIMIT ${limit}
        `);

        return rows.rows.map((row) => ({
            source: row.source,
            rateNum: BigInt(row.rate_num),
            rateDen: BigInt(row.rate_den),
            asOf: new Date(row.as_of),
        }));
    }

    return { getRateHistory };
}
