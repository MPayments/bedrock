import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  feeRules,
  type FeeSettlementMode,
} from "../../../fees/adapters/drizzle/schema";
import type {
  QuoteLegSourceKind,
  QuotePricingMode,
  QuoteStatus,
} from "../../domain/quote-types";

export type FeeComponentSource = "rule" | "manual";
export interface SerializedQuoteCommercialTerms {
  agreementVersionId: string | null;
  agreementFeeBps: string;
  quoteMarkupBps: string;
  totalFeeBps: string;
  fixedFeeAmountMinor: string | null;
  fixedFeeCurrency: string | null;
}

export const fxQuotes = pgTable(
  "fx_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromCurrencyId: uuid("from_currency_id").notNull(),
    toCurrencyId: uuid("to_currency_id").notNull(),
    fromAmountMinor: bigint("from_amount_minor", { mode: "bigint" }).notNull(),
    toAmountMinor: bigint("to_amount_minor", { mode: "bigint" }).notNull(),
    pricingMode: text("pricing_mode")
      .$type<QuotePricingMode>()
      .notNull()
      .default("auto_cross"),
    pricingTrace: jsonb("pricing_trace")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    commercialTerms:
      jsonb("commercial_terms").$type<SerializedQuoteCommercialTerms | null>(),
    dealDirection: text("deal_direction"),
    dealForm: text("deal_form"),
    rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
    rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),
    status: text("status").$type<QuoteStatus>().notNull().default("active"),
    dealId: uuid("deal_id"),
    usedByRef: text("used_by_ref"),
    usedDocumentId: uuid("used_document_id"),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("fx_quotes_idem_uq").on(table.idempotencyKey),
    index("fx_quotes_deal_created_idx").on(table.dealId, table.createdAt),
    index("fx_quotes_status_idx").on(table.status),
    index("fx_quotes_expires_idx").on(table.expiresAt),
    index("fx_quotes_used_document_idx").on(table.usedDocumentId),
  ],
);

export const fxQuoteLegs = pgTable(
  "fx_quote_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => fxQuotes.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    fromCurrencyId: uuid("from_currency_id").notNull(),
    toCurrencyId: uuid("to_currency_id").notNull(),
    fromAmountMinor: bigint("from_amount_minor", { mode: "bigint" }).notNull(),
    toAmountMinor: bigint("to_amount_minor", { mode: "bigint" }).notNull(),
    rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
    rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),
    sourceKind: text("source_kind")
      .$type<QuoteLegSourceKind>()
      .notNull()
      .default("derived"),
    sourceRef: text("source_ref"),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    executionCounterpartyId: uuid("execution_counterparty_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("fx_quote_legs_quote_idx_uq").on(table.quoteId, table.idx),
    index("fx_quote_legs_quote_idx").on(table.quoteId),
  ],
);

export const fxQuoteFeeComponents = pgTable(
  "fx_quote_fee_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id").notNull(),
    idx: integer("idx").notNull(),
    ruleId: uuid("rule_id").references(() => feeRules.id),
    kind: text("kind").notNull(),
    currencyId: uuid("currency_id").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    source: text("source")
      .$type<FeeComponentSource>()
      .notNull()
      .default("rule"),
    settlementMode: text("settlement_mode")
      .$type<FeeSettlementMode>()
      .notNull()
      .default("in_ledger"),
    debitAccountKey: text("debit_account_key"),
    creditAccountKey: text("credit_account_key"),
    transferCode: integer("transfer_code"),
    memo: text("memo"),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("fx_quote_fee_components_quote_idx_uq").on(
      table.quoteId,
      table.idx,
    ),
    index("fx_quote_fee_components_quote_id_idx").on(table.quoteId),
  ],
);

export const fxQuoteFinancialLines = pgTable(
  "fx_quote_financial_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => fxQuotes.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    bucket: text("bucket").notNull(),
    currencyId: uuid("currency_id").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    source: text("source").notNull(),
    settlementMode: text("settlement_mode").notNull(),
    memo: text("memo"),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("fx_quote_financial_lines_quote_idx_uq").on(
      table.quoteId,
      table.idx,
    ),
    index("fx_quote_financial_lines_quote_id_idx").on(table.quoteId),
  ],
);

export type Quote = typeof fxQuotes.$inferSelect & {
  fromCurrency?: string;
  toCurrency?: string;
};

export type QuoteLeg = typeof fxQuoteLegs.$inferSelect & {
  fromCurrency?: string;
  toCurrency?: string;
};

export type QuoteFinancialLine = typeof fxQuoteFinancialLines.$inferSelect;
