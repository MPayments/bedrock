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

import { books } from "./books";
import { bookAccountInstances } from "./ledger";

export type LedgerOperationStatus = "pending" | "posted" | "failed";

export const ledgerOperations = pgTable(
  "ledger_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),

    operationCode: text("operation_code").notNull(),
    operationVersion: integer("operation_version").notNull().default(1),

    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),

    postingDate: timestamp("posting_date", { withTimezone: true }).notNull(),
    status: text("status").$type<LedgerOperationStatus>().notNull().default("pending"),
    error: text("error"),
    postedAt: timestamp("posted_at", { withTimezone: true }),

    outboxAttempts: integer("outbox_attempts").notNull().default(0),
    lastOutboxErrorAt: timestamp("last_outbox_error_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("ledger_operations_idem_uq").on(t.idempotencyKey),
    index("ledger_operations_status_idx").on(t.status),
    index("ledger_operations_source_idx").on(t.sourceType, t.sourceId),
  ],
);

export const postings = pgTable(
  "postings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    operationId: uuid("operation_id")
      .notNull()
      .references(() => ledgerOperations.id, { onDelete: "restrict" }),

    lineNo: integer("line_no").notNull(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),

    debitInstanceId: uuid("debit_instance_id")
      .notNull()
      .references(() => bookAccountInstances.id),
    creditInstanceId: uuid("credit_instance_id")
      .notNull()
      .references(() => bookAccountInstances.id),

    postingCode: text("posting_code").notNull(),

    currency: text("currency").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    memo: text("memo"),

    context: jsonb("context").$type<Record<string, string>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("postings_op_line_uq").on(t.operationId, t.lineNo),
    index("postings_op_idx").on(t.operationId),
    index("postings_book_currency_idx").on(t.bookId, t.currency),
  ],
);
