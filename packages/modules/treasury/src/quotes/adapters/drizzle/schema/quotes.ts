import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, bigint, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

import type {
    QuotePricingMode,
    QuoteStatus,
} from "../../../domain/quote-types";
export type Quote = typeof fxQuotes.$inferSelect & {
    fromCurrency?: string;
    toCurrency?: string;
};

export const fxQuotes = pgTable(
    "fx_quotes",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        fromCurrencyId: uuid("from_currency_id").notNull(),
        toCurrencyId: uuid("to_currency_id").notNull(),

        fromAmountMinor: bigint("from_amount_minor", { mode: "bigint" }).notNull(),
        toAmountMinor: bigint("to_amount_minor", { mode: "bigint" }).notNull(),

        pricingMode: text("pricing_mode").$type<QuotePricingMode>().notNull().default("auto_cross"),
        pricingTrace: jsonb("pricing_trace").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
        dealDirection: text("deal_direction"),
        dealForm: text("deal_form"),

        rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
        rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),

        status: text("status").$type<QuoteStatus>().notNull().default("active"),
        usedByRef: text("used_by_ref"),
        usedAt: timestamp("used_at", { withTimezone: true }),

        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

        idempotencyKey: text("idempotency_key").notNull(),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => [
        uniqueIndex("fx_quotes_idem_uq").on(t.idempotencyKey),
        index("fx_quotes_status_idx").on(t.status),
        index("fx_quotes_expires_idx").on(t.expiresAt)
    ]
);
