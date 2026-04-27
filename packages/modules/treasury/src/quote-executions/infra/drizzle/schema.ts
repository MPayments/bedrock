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

import type {
  PaymentStepOrigin,
  PostingDocumentRef,
} from "../../../payment-steps/domain/types";
import type {
  QuoteExecutionSettlementRoute,
  QuoteExecutionState,
} from "../../domain/types";

export const quoteExecutions = pgTable(
  "quote_executions",
  {
    id: uuid("id").primaryKey(),
    sourceRef: text("source_ref").notNull(),
    state: text("state").$type<QuoteExecutionState>().notNull().default("draft"),
    origin: jsonb("origin").$type<PaymentStepOrigin>().notNull(),
    dealId: uuid("deal_id"),
    treasuryOrderId: uuid("treasury_order_id"),
    quoteId: uuid("quote_id").notNull(),
    quoteLegIdx: integer("quote_leg_idx"),
    quoteSnapshot: jsonb("quote_snapshot").$type<unknown>(),
    fromCurrencyId: uuid("from_currency_id")
      .notNull()
      .references(() => currencies.id),
    toCurrencyId: uuid("to_currency_id")
      .notNull()
      .references(() => currencies.id),
    fromAmountMinor: bigint("from_amount_minor", { mode: "bigint" }).notNull(),
    toAmountMinor: bigint("to_amount_minor", { mode: "bigint" }).notNull(),
    rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
    rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),
    settlementRoute: jsonb("settlement_route")
      .$type<QuoteExecutionSettlementRoute>()
      .notNull(),
    providerRef: text("provider_ref"),
    providerSnapshot: jsonb("provider_snapshot").$type<unknown>(),
    postingDocumentRefs: jsonb("posting_document_refs")
      .$type<PostingDocumentRef[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("quote_executions_source_ref_uq").on(table.sourceRef),
    index("quote_executions_state_idx").on(table.state),
    index("quote_executions_deal_idx").on(table.dealId),
    index("quote_executions_order_idx").on(table.treasuryOrderId),
    index("quote_executions_quote_idx").on(table.quoteId),
  ],
);
