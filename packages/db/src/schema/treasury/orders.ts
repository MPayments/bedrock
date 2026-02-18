import { sql } from "drizzle-orm";
import {
    pgTable, text, timestamp, uuid, bigint, index, uniqueIndex
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { customers } from "../customers";
import { bankAccounts } from "./bank-accounts";
import { journalEntries } from "../ledger/journal";
import { uint128 } from "../ledger/ledger";
import { currencies } from "../currencies";

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

        customerOrgId: uuid("customer_org_id").notNull().references(() => organizations.id),
        customerId: uuid("customer_id").notNull().references(() => customers.id),

        status: text("status").$type<OrderStatus>().notNull().default("quote"),

        // current ledger entry driving the *_pending_posting state
        ledgerEntryId: uuid("ledger_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),

        payInCurrencyId: uuid("payin_currency_id").notNull().references(() => currencies.id),
        payInExpectedMinor: bigint("payin_expected_minor", { mode: "bigint" }).notNull(),

        payOutCurrencyId: uuid("payout_currency_id").notNull().references(() => currencies.id),
        payOutAmountMinor: bigint("payout_amount_minor", { mode: "bigint" }).notNull(),

        payInOrgId: uuid("payin_org_id").notNull().references(() => organizations.id),
        payInAccountId: uuid("payin_account_id").references(() => bankAccounts.id),

        payOutOrgId: uuid("payout_org_id").notNull().references(() => organizations.id),
        payOutAccountId: uuid("payout_account_id").references(() => bankAccounts.id),

        beneficiaryName: text("beneficiary_name"),
        beneficiaryCountry: text("beneficiary_country"),
        beneficiaryInvoiceRef: text("beneficiary_invoice_ref"),

        idempotencyKey: text("idempotency_key").notNull(),

        payoutPendingTransferId: uint128("payout_pending_transfer_id"),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date())
    },
    (t) => ([
        index("orders_status_idx").on(t.status),
        uniqueIndex("orders_idem_uq").on(t.idempotencyKey)
    ])
);

export type PaymentOrder = typeof paymentOrders.$inferSelect;

export type SettlementKind = "funding" | "payout";
export type SettlementStatus = "pending" | "settled" | "failed";

export const settlements = pgTable(
    "settlements",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        orderId: uuid("order_id").notNull().references(() => paymentOrders.id, { onDelete: "cascade" }),

        kind: text("kind").$type<SettlementKind>().notNull(),
        status: text("status").$type<SettlementStatus>().notNull().default("pending"),

        currencyId: uuid("currency_id").notNull().references(() => currencies.id),
        amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),

        railRef: text("rail_ref"),
        occurredAt: timestamp("occurred_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    }
);
