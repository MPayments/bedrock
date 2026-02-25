import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { bookAccounts } from "./ledger";

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

export const ledgerPostings = pgTable(
  "ledger_postings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    operationId: uuid("operation_id")
      .notNull()
      .references(() => ledgerOperations.id, { onDelete: "cascade" }),

    lineNo: integer("line_no").notNull(),
    bookOrgId: uuid("book_org_id").notNull(),

    debitBookAccountId: uuid("debit_book_account_id")
      .notNull()
      .references(() => bookAccounts.id),
    creditBookAccountId: uuid("credit_book_account_id")
      .notNull()
      .references(() => bookAccounts.id),

    postingCode: text("posting_code").notNull(),

    currency: text("currency").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    memo: text("memo"),

    analyticCounterpartyId: uuid("analytic_counterparty_id"),
    analyticCustomerId: uuid("analytic_customer_id"),
    analyticOrderId: uuid("analytic_order_id"),
    analyticOperationalAccountId: uuid("analytic_operational_account_id"),
    analyticTransferId: uuid("analytic_transfer_id"),
    analyticQuoteId: uuid("analytic_quote_id"),
    analyticFeeBucket: text("analytic_fee_bucket"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("ledger_postings_op_line_uq").on(t.operationId, t.lineNo),
    index("ledger_postings_op_idx").on(t.operationId),
    index("ledger_postings_org_currency_idx").on(t.bookOrgId, t.currency),
  ],
);
