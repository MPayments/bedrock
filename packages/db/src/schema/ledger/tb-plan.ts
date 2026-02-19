import { sql } from "drizzle-orm";
import {
    pgTable,
    uuid,
    text,
    timestamp,
    bigint,
    integer,
    boolean,
    index,
    uniqueIndex,
    check
} from "drizzle-orm/pg-core";

import { journalEntries } from "./journal";
import { uint128 } from "./ledger";

export type TbPlanStatus = "pending" | "posted" | "failed";
export type TbPlanType = "create" | "post_pending" | "void_pending";

export const tbTransferPlans = pgTable(
    "tb_transfer_plans",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        orgId: uuid("org_id").notNull(),

        journalEntryId: uuid("journal_entry_id")
            .notNull()
            .references(() => journalEntries.id, { onDelete: "cascade" }),

        idx: integer("idx").notNull(),

        planKey: text("plan_key").notNull(),
        type: text("type").$type<TbPlanType>().notNull().default("create"),

        chainId: text("chain_id"),

        transferId: uint128("transfer_id").notNull(),

        debitKey: text("debit_key"),
        creditKey: text("credit_key"),

        currency: text("currency").notNull(),
        tbLedger: bigint("tb_ledger", { mode: "number" }).notNull(),

        amount: bigint("amount", { mode: "bigint" }).notNull().default(sql`0`),
        code: integer("code").notNull().default(1),

        isLinked: boolean("is_linked").notNull().default(false),

        isPending: boolean("is_pending").notNull().default(false),
        timeoutSeconds: integer("timeout_seconds").notNull().default(0),

        pendingId: uint128("pending_id"),

        status: text("status").$type<TbPlanStatus>().notNull().default("pending"),
        error: text("error"),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => ([
        // Worker query: org + entry + idx
        index("tb_plan_post_idx").on(t.orgId, t.journalEntryId, t.idx),

        // uniqueness & lookups
        uniqueIndex("tb_plan_entry_idx_uq").on(t.journalEntryId, t.idx),
        uniqueIndex("tb_plan_org_transfer_uq").on(t.orgId, t.transferId),
        index("tb_plan_status_idx").on(t.orgId, t.status),

        // invariants (DB-level hardening)
        check("tb_plan_amount_nonneg", sql`${t.amount} >= 0`),
        check(
            "tb_plan_create_keys",
            sql`(${t.type} <> 'create') OR (${t.debitKey} IS NOT NULL AND ${t.creditKey} IS NOT NULL)`
        ),
        check(
            "tb_plan_pending_id",
            sql`(${t.type} = 'create') OR (${t.pendingId} IS NOT NULL)`
        ),
        check(
            "tb_plan_void_amount",
            sql`(${t.type} <> 'void_pending') OR (${t.amount} = 0)`
        ),
        check(
            "tb_plan_timeout",
            sql`(${t.isPending} = false) OR (${t.timeoutSeconds} > 0)`
        )
    ])
);
