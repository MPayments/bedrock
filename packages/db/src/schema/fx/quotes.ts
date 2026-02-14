import { pgTable, uuid, text, timestamp, bigint, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { fxPolicies } from "./policies";
import { sql } from "drizzle-orm";

export type FxQuoteStatus = "active" | "used" | "expired" | "cancelled";
export type FxQuotePricingMode = "auto_cross" | "explicit_route";
export type FxQuote = typeof fxQuotes.$inferSelect;

export const fxQuotes = pgTable(
    "fx_quotes",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        policyId: uuid("policy_id").notNull().references(() => fxPolicies.id),

        fromCurrency: text("from_currency").notNull(),
        toCurrency: text("to_currency").notNull(),

        fromAmountMinor: bigint("from_amount_minor", { mode: "bigint" }).notNull(),
        toAmountMinor: bigint("to_amount_minor", { mode: "bigint" }).notNull(),

        pricingMode: text("pricing_mode").$type<FxQuotePricingMode>().notNull().default("auto_cross"),
        pricingTrace: jsonb("pricing_trace").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
        dealDirection: text("deal_direction"),
        dealForm: text("deal_form"),

        rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
        rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),

        status: text("status").$type<FxQuoteStatus>().notNull().default("active"),
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
