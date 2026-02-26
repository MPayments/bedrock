import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { counterparties } from "./counterparties";
import { currencies } from "../currencies";
import { customers } from "../customers";
import { operationalAccounts } from "./accounts";
import { ledgerOperations } from "../ledger/journal";
import { uint128 } from "../ledger/ledger";

export type OrderStatus =
  | "quote"
  | "funding_pending"
  | "funding_settled_pending_posting"
  | "funding_settled"
  | "fx_executed_pending_posting"
  | "fx_executed"
  | "payout_initiated_pending_posting"
  | "payout_initiated"
  | "closed_pending_posting"
  | "closed"
  | "failed_pending_posting"
  | "failed";

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    customerCounterpartyId: uuid("customer_counterparty_id")
      .notNull()
      .references(() => counterparties.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),

    status: text("status").$type<OrderStatus>().notNull().default("quote"),

    ledgerOperationId: uuid("ledger_operation_id").references(
      () => ledgerOperations.id,
      {
        onDelete: "set null",
      },
    ),

    payInCurrencyId: uuid("payin_currency_id")
      .notNull()
      .references(() => currencies.id),
    payInExpectedMinor: bigint("payin_expected_minor", {
      mode: "bigint",
    }).notNull(),

    payOutCurrencyId: uuid("payout_currency_id")
      .notNull()
      .references(() => currencies.id),
    payOutAmountMinor: bigint("payout_amount_minor", {
      mode: "bigint",
    }).notNull(),

    payInCounterpartyId: uuid("payin_counterparty_id")
      .notNull()
      .references(() => counterparties.id),
    payInAccountId: uuid("payin_account_id").references(
      () => operationalAccounts.id,
    ),

    payOutCounterpartyId: uuid("payout_counterparty_id")
      .notNull()
      .references(() => counterparties.id),
    payOutAccountId: uuid("payout_account_id").references(
      () => operationalAccounts.id,
    ),

    beneficiaryName: text("beneficiary_name"),
    beneficiaryCountry: text("beneficiary_country"),
    beneficiaryInvoiceRef: text("beneficiary_invoice_ref"),

    idempotencyKey: text("idempotency_key").notNull(),

    payoutPendingTransferId: uint128("payout_pending_transfer_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    uniqueIndex("orders_idem_uq").on(t.idempotencyKey),
  ],
);

export type PaymentOrder = typeof paymentOrders.$inferSelect;

export type SettlementKind = "funding" | "payout";
export type SettlementStatus = "pending" | "settled" | "failed";

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => paymentOrders.id, { onDelete: "cascade" }),

  kind: text("kind").$type<SettlementKind>().notNull(),
  status: text("status").$type<SettlementStatus>().notNull().default("pending"),

  currencyId: uuid("currency_id")
    .notNull()
    .references(() => currencies.id),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),

  railRef: text("rail_ref"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
