import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

import { currencies } from "./currencies";

export enum TransferStatus {
    DRAFT = "draft",
    APPROVED_PENDING_POSTING = "approved_pending_posting",
    POSTED = "posted",
    REJECTED = "rejected",
    FAILED = "failed",
}

export const internalTransfers = pgTable(
    "internal_transfers",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        counterpartyId: uuid("counterparty_id").notNull(),

        status: text("status").$type<TransferStatus>().notNull().default(TransferStatus.DRAFT),

        // счета/участники задаются keyspace-ключами (инвариант ledger)
        fromAccountKey: text("from_account_key").notNull(),
        toAccountKey: text("to_account_key").notNull(),

        currencyId: uuid("currency_id").notNull().references(() => currencies.id),
        amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),

        memo: text("memo"),

        // maker/checker
        makerUserId: uuid("maker_user_id").notNull(),
        checkerUserId: uuid("checker_user_id"),
        approvedAt: timestamp("approved_at", { withTimezone: true }),
        rejectedAt: timestamp("rejected_at", { withTimezone: true }),
        rejectReason: text("reject_reason"),

        // привязка к ledger
        ledgerEntryId: uuid("ledger_entry_id"),
        idempotencyKey: text("idempotency_key").notNull(),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
    },
    (t) => [
        uniqueIndex("internal_transfers_counterparty_idem_uq").on(t.counterpartyId, t.idempotencyKey),
        index("internal_transfers_counterparty_status_idx").on(t.counterpartyId, t.status),
        index("internal_transfers_counterparty_created_idx").on(t.counterpartyId, t.createdAt),
    ],
);
