import { sql } from "drizzle-orm";
import {
    pgTable, text, timestamp, uuid, bigint, index, uniqueIndex
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { customers } from "./customers.js";
import { bankAccounts } from "./bank-accounts";
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

        treasuryOrgId: uuid("treasury_org_id").notNull().references(() => organizations.id),
        customerOrgId: uuid("customer_org_id").notNull().references(() => organizations.id),
        customerId: uuid("customer_id").notNull().references(() => customers.id),

        status: text("status").$type<OrderStatus>().notNull().default("quote"),

        // current ledger entry driving the *_pending_posting state
        ledgerEntryId: uuid("ledger_entry_id"),

        payInCurrency: text("payin_currency").notNull(),
        payInExpectedMinor: bigint("payin_expected_minor", { mode: "bigint" }).notNull(),

        payOutCurrency: text("payout_currency").notNull(),
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
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => ([
        index("orders_treasury_status_idx").on(t.treasuryOrgId, t.status),
        uniqueIndex("orders_treasury_idem_uq").on(t.treasuryOrgId, t.idempotencyKey)
    ])
);

export const fxQuotes = pgTable(
    "fx_quotes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        orderId: uuid("order_id").notNull().references(() => paymentOrders.id, { onDelete: "cascade" }),

        baseCurrency: text("base_currency").notNull(),
        quoteCurrency: text("quote_currency").notNull(),

        baseAmountMinor: bigint("base_amount_minor", { mode: "bigint" }).notNull(),
        quoteAmountMinor: bigint("quote_amount_minor", { mode: "bigint" }).notNull(),

        feeBaseMinor: bigint("fee_base_minor", { mode: "bigint" }).notNull().default(0n),
        spreadBaseMinor: bigint("spread_base_minor", { mode: "bigint" }).notNull().default(0n),

        rateNumerator: bigint("rate_num", { mode: "bigint" }).notNull(),
        rateDenominator: bigint("rate_den", { mode: "bigint" }).notNull(),

        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    }
);

export type SettlementKind = "funding" | "payout";
export type SettlementStatus = "pending" | "settled" | "failed";

export const settlements = pgTable(
    "settlements",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        orderId: uuid("order_id").notNull().references(() => paymentOrders.id, { onDelete: "cascade" }),

        kind: text("kind").$type<SettlementKind>().notNull(),
        status: text("status").$type<SettlementStatus>().notNull().default("pending"),

        currency: text("currency").notNull(),
        amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),

        railRef: text("rail_ref"),
        occurredAt: timestamp("occurred_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    }
);
