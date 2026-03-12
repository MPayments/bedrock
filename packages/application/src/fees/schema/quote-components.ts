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

import { currencies } from "@bedrock/application/currencies/schema";

import { feeRules, type FeeSettlementMode } from "./rules";
import { fxQuotes } from "../../fx/schema/quotes";

export type FeeComponentSource = "rule" | "manual";

export const fxQuoteFeeComponents = pgTable(
  "fx_quote_fee_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => fxQuotes.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),

    ruleId: uuid("rule_id").references(() => feeRules.id),

    kind: text("kind").notNull(),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
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
  (t) => [
    uniqueIndex("fx_quote_fee_components_quote_idx_uq").on(t.quoteId, t.idx),
    index("fx_quote_fee_components_quote_id_idx").on(t.quoteId),
  ],
);
