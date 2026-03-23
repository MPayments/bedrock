import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

export type Rate = typeof fxRates.$inferSelect;
export type RateInsert = typeof fxRates.$inferInsert;

/**
 * rate: base -> quote
 * quote_amount = base_amount * rate_num / rate_den
 */
export const fxRates = pgTable(
    "fx_rates",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        source: text("source").notNull().default("manual"),

        baseCurrencyId: uuid("base_currency_id").notNull(),
        quoteCurrencyId: uuid("quote_currency_id").notNull(),

        rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
        rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),

        asOf: timestamp("as_of", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => [
        uniqueIndex("fx_rates_source_pair_asof_uq").on(t.source, t.baseCurrencyId, t.quoteCurrencyId, t.asOf),
        index("fx_rates_pair_asof_idx").on(t.baseCurrencyId, t.quoteCurrencyId, t.asOf),
        index("fx_rates_asof_idx").on(t.asOf),
        index("fx_rates_source_asof_idx").on(t.source, t.asOf),
    ]
);
