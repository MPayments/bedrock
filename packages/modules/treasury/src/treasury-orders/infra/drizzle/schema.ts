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
  TreasuryInventoryAllocationState,
  TreasuryInventoryPositionState,
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

export const treasuryInventoryPositions = pgTable(
  "treasury_inventory_positions",
  {
    id: uuid("id").primaryKey(),
    sourceOrderId: uuid("source_order_id")
      .notNull()
      .references(() => treasuryOrders.id),
    sourceQuoteExecutionId: uuid("source_quote_execution_id")
      .notNull()
      .references(() => quoteExecutions.id),
    ownerPartyId: uuid("owner_party_id").notNull(),
    ownerRequisiteId: uuid("owner_requisite_id").notNull(),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    ownerBookId: uuid("owner_book_id").notNull(),
    ledgerSubjectType: text("ledger_subject_type")
      .$type<"organization_requisite">()
      .notNull()
      .default("organization_requisite"),
    acquiredAmountMinor: bigint("acquired_amount_minor", {
      mode: "bigint",
    }).notNull(),
    availableAmountMinor: bigint("available_amount_minor", {
      mode: "bigint",
    }).notNull(),
    costCurrencyId: uuid("cost_currency_id")
      .notNull()
      .references(() => currencies.id),
    costAmountMinor: bigint("cost_amount_minor", { mode: "bigint" }).notNull(),
    sourcePostingDocumentId: uuid("source_posting_document_id").notNull(),
    sourcePostingDocumentKind: text("source_posting_document_kind")
      .$type<"fx_execute">()
      .notNull(),
    state: text("state")
      .$type<TreasuryInventoryPositionState>()
      .notNull()
      .default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_inventory_positions_quote_execution_uq").on(
      table.sourceQuoteExecutionId,
    ),
    index("treasury_inventory_positions_order_idx").on(table.sourceOrderId),
    index("treasury_inventory_positions_currency_idx").on(table.currencyId),
    index("treasury_inventory_positions_owner_idx").on(table.ownerPartyId),
    index("treasury_inventory_positions_owner_book_idx").on(table.ownerBookId),
    index("treasury_inventory_positions_source_document_idx").on(
      table.sourcePostingDocumentId,
    ),
    index("treasury_inventory_positions_state_idx").on(table.state),
  ],
);

export const treasuryInventoryAllocations = pgTable(
  "treasury_inventory_allocations",
  {
    id: uuid("id").primaryKey(),
    positionId: uuid("position_id")
      .notNull()
      .references(() => treasuryInventoryPositions.id),
    dealId: uuid("deal_id").notNull(),
    quoteId: uuid("quote_id"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    costAmountMinor: bigint("cost_amount_minor", { mode: "bigint" }).notNull(),
    ledgerHoldRef: text("ledger_hold_ref").notNull(),
    ownerBookId: uuid("owner_book_id").notNull(),
    ownerRequisiteId: uuid("owner_requisite_id").notNull(),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    state: text("state")
      .$type<TreasuryInventoryAllocationState>()
      .notNull()
      .default("reserved"),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_inventory_allocations_position_deal_quote_uq").on(
      table.positionId,
      table.dealId,
      table.quoteId,
    ),
    index("treasury_inventory_allocations_position_idx").on(table.positionId),
    index("treasury_inventory_allocations_deal_idx").on(table.dealId),
    index("treasury_inventory_allocations_hold_ref_idx").on(table.ledgerHoldRef),
    index("treasury_inventory_allocations_quote_idx").on(table.quoteId),
    index("treasury_inventory_allocations_state_idx").on(table.state),
  ],
);
