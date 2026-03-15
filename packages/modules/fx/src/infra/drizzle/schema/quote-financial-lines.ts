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

import { currencies } from "@bedrock/currencies/schema";

import { fxQuotes } from "./quotes";

export type FxQuoteFinancialLine = typeof fxQuoteFinancialLines.$inferSelect;

export const fxQuoteFinancialLines = pgTable(
  "fx_quote_financial_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => fxQuotes.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    bucket: text("bucket").notNull(),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    source: text("source").notNull(),
    settlementMode: text("settlement_mode").notNull(),
    memo: text("memo"),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("fx_quote_financial_lines_quote_idx_uq").on(t.quoteId, t.idx),
    index("fx_quote_financial_lines_quote_id_idx").on(t.quoteId),
  ],
);
