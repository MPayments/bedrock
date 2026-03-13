import { sql } from "drizzle-orm";
import { bigint, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { counterparties } from "@bedrock/counterparties/schema";
import { currencies } from "@bedrock/currencies/schema";

import { fxQuotes } from "./quotes";

export type FxQuoteLegSourceKind = "cb" | "bank" | "manual" | "derived" | "market";

export const fxQuoteLegs = pgTable(
    "fx_quote_legs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        quoteId: uuid("quote_id")
            .notNull()
            .references(() => fxQuotes.id, { onDelete: "cascade" }),
        idx: integer("idx").notNull(),

        fromCurrencyId: uuid("from_currency_id").notNull().references(() => currencies.id),
        toCurrencyId: uuid("to_currency_id").notNull().references(() => currencies.id),

        fromAmountMinor: bigint("from_amount_minor", { mode: "bigint" }).notNull(),
        toAmountMinor: bigint("to_amount_minor", { mode: "bigint" }).notNull(),

        rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
        rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),

        sourceKind: text("source_kind").$type<FxQuoteLegSourceKind>().notNull().default("derived"),
        sourceRef: text("source_ref"),
        asOf: timestamp("as_of", { withTimezone: true }).notNull(),

        executionCounterpartyId: uuid("execution_counterparty_id").references(() => counterparties.id),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    },
    (t) => ([
        uniqueIndex("fx_quote_legs_quote_idx_uq").on(t.quoteId, t.idx),
        index("fx_quote_legs_quote_idx").on(t.quoteId),
    ]),
);

export type FxQuoteLeg = typeof fxQuoteLegs.$inferSelect & {
    fromCurrency?: string;
    toCurrency?: string;
};
