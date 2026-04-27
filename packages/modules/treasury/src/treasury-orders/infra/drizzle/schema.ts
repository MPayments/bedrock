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

import type { PaymentStepRate } from "../../../payment-steps/domain/types";
import { paymentSteps } from "../../../payment-steps/infra/drizzle/schema";
import { quoteExecutions } from "../../../quote-executions/infra/drizzle/schema";
import type {
  TreasuryOrderState,
  TreasuryOrderStepKind,
  TreasuryOrderType,
} from "../../domain/types";

export const treasuryOrders = pgTable(
  "treasury_orders",
  {
    id: uuid("id").primaryKey(),
    type: text("type").$type<TreasuryOrderType>().notNull(),
    state: text("state").$type<TreasuryOrderState>().notNull().default("draft"),
    description: text("description"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("treasury_orders_type_idx").on(table.type),
    index("treasury_orders_state_idx").on(table.state),
    index("treasury_orders_created_at_idx").on(table.createdAt),
  ],
);

export const treasuryOrderSteps = pgTable(
  "treasury_order_steps",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => treasuryOrders.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    kind: text("kind").$type<TreasuryOrderStepKind>().notNull(),
    sourceRef: text("source_ref").notNull(),
    paymentStepId: uuid("payment_step_id").references(() => paymentSteps.id),
    quoteExecutionId: uuid("quote_execution_id").references(
      () => quoteExecutions.id,
    ),
    quoteId: uuid("quote_id"),
    fromPartyId: uuid("from_party_id").notNull(),
    fromRequisiteId: uuid("from_requisite_id"),
    toPartyId: uuid("to_party_id").notNull(),
    toRequisiteId: uuid("to_requisite_id"),
    fromCurrencyId: uuid("from_currency_id")
      .notNull()
      .references(() => currencies.id),
    toCurrencyId: uuid("to_currency_id")
      .notNull()
      .references(() => currencies.id),
    fromAmountMinor: bigint("from_amount_minor", { mode: "bigint" }),
    toAmountMinor: bigint("to_amount_minor", { mode: "bigint" }),
    rate: jsonb("rate").$type<PaymentStepRate | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_order_steps_order_sequence_uq").on(
      table.orderId,
      table.sequence,
    ),
    uniqueIndex("treasury_order_steps_source_ref_uq").on(table.sourceRef),
    index("treasury_order_steps_order_idx").on(table.orderId),
    index("treasury_order_steps_payment_step_idx").on(table.paymentStepId),
    index("treasury_order_steps_quote_execution_idx").on(
      table.quoteExecutionId,
    ),
  ],
);
