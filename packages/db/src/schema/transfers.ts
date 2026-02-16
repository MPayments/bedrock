import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

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

        orgId: uuid("org_id").notNull(), // “юридическое лицо/организация” внутри которой делаем перевод (или treasury)

        status: text("status").$type<TransferStatus>().notNull().default(TransferStatus.DRAFT),

        // счета/участники задаются keyspace-ключами (инвариант ledger)
        fromAccountKey: text("from_account_key").notNull(),
        toAccountKey: text("to_account_key").notNull(),

        currency: text("currency").notNull(),
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
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => [
        uniqueIndex("internal_transfers_org_idem_uq").on(t.orgId, t.idempotencyKey),
        index("internal_transfers_org_status_idx").on(t.orgId, t.status),
        index("internal_transfers_org_created_idx").on(t.orgId, t.createdAt)
    ]
);
