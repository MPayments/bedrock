import { sql } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { paymentOrders } from "./orders";
import { fxQuotes } from "../fx/quotes";
import { journalEntries } from "../ledger/journal";
import { uint128 } from "../ledger/ledger";
import { organizations } from "./organizations";
import { currencies } from "../currencies";

export type FeePaymentOrderStatus =
    | "reserved"
    | "initiated_pending_posting"
    | "initiated"
    | "settled_pending_posting"
    | "settled"
    | "voided_pending_posting"
    | "voided"
    | "failed";

export const feePaymentOrders = pgTable(
    "fee_payment_orders",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        parentOrderId: uuid("parent_order_id")
            .notNull()
            .references(() => paymentOrders.id, { onDelete: "cascade" }),
        quoteId: uuid("quote_id").references(() => fxQuotes.id, { onDelete: "set null" }),
        componentId: text("component_id").notNull(),
        idempotencyKey: text("idempotency_key").notNull(),

        kind: text("kind").notNull(),
        bucket: text("bucket").notNull(),
        currencyId: uuid("currency_id").notNull().references(() => currencies.id),
        amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
        metadata: jsonb("metadata").$type<Record<string, string>>(),
        memo: text("memo"),

        reserveEntryId: uuid("reserve_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
        initiateEntryId: uuid("initiate_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
        resolveEntryId: uuid("resolve_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
        pendingTransferId: uint128("pending_transfer_id"),

        payoutOrgId: uuid("payout_org_id").references(() => organizations.id),
        payoutBankStableKey: text("payout_bank_stable_key"),
        railRef: text("rail_ref"),

        status: text("status").$type<FeePaymentOrderStatus>().notNull().default("reserved"),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
    },
    (t) => ([
        uniqueIndex("fee_payment_orders_idem_uq").on(t.idempotencyKey),
        index("fee_payment_orders_status_idx").on(t.status),
        index("fee_payment_orders_parent_idx").on(t.parentOrderId),
    ])
);

export type FeePaymentOrder = typeof feePaymentOrders.$inferSelect;