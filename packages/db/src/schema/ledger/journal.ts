import { sql } from "drizzle-orm";
import {
    pgTable,
    uuid,
    text,
    timestamp,
    bigint,
    integer,
    index,
    uniqueIndex
} from "drizzle-orm/pg-core";

export type JournalStatus = "pending" | "posted" | "failed";
export type JournalSide = "debit" | "credit";

export const journalEntries = pgTable(
    "journal_entries",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        orgId: uuid("org_id").notNull(),

        sourceType: text("source_type").notNull(),
        sourceId: text("source_id").notNull(),
        idempotencyKey: text("idempotency_key").notNull(),

        planFingerprint: text("plan_fingerprint").notNull(),

        postingDate: timestamp("posting_date", { withTimezone: true }).notNull(),
        status: text("status").$type<JournalStatus>().notNull().default("pending"),
        error: text("error"),
        postedAt: timestamp("posted_at", { withTimezone: true }),

        // observability
        outboxAttempts: integer("outbox_attempts").notNull().default(0),
        lastOutboxErrorAt: timestamp("last_outbox_error_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => ([
        index("journal_entries_org_status_idx").on(t.orgId, t.status),
        uniqueIndex("journal_entries_org_idem_uq").on(t.orgId, t.idempotencyKey)
    ])
);

export const journalLines = pgTable(
    "journal_lines",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        orgId: uuid("org_id").notNull(),
        entryId: uuid("entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),

        lineNo: integer("line_no").notNull(),
        accountKey: text("account_key").notNull(),

        side: text("side").$type<JournalSide>().notNull(),
        currency: text("currency").notNull(),
        amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),

        memo: text("memo"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => ([
        index("journal_lines_entry_idx").on(t.entryId),
        uniqueIndex("journal_lines_entry_lineno_uq").on(t.entryId, t.lineNo)
    ])
);
