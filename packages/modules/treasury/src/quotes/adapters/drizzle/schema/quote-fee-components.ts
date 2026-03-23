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
} from "../../../../fees/adapters/drizzle/schema/rules";

export type FeeComponentSource = "rule" | "manual";

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
