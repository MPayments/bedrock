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
import { ledgerOperations } from "./ledger/journal";

export type BalanceHoldState = "active" | "released" | "consumed";

export const balancePositions = pgTable(
  "balance_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    currency: text("currency").notNull(),
    ledgerBalance: bigint("ledger_balance", { mode: "bigint" })
      .notNull()
      .default(0n),
    available: bigint("available", { mode: "bigint" }).notNull().default(0n),
    reserved: bigint("reserved", { mode: "bigint" }).notNull().default(0n),
    pending: bigint("pending", { mode: "bigint" }).notNull().default(0n),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("balance_positions_subject_uq").on(
      t.bookId,
      t.subjectType,
      t.subjectId,
      t.currency,
    ),
    index("balance_positions_subject_idx").on(
      t.bookId,
      t.subjectType,
      t.subjectId,
      t.currency,
    ),
  ],
);

export const balanceHolds = pgTable(
  "balance_holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    currency: text("currency").notNull(),
    holdRef: text("hold_ref").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    state: text("state").$type<BalanceHoldState>().notNull().default("active"),
    reason: text("reason"),
    actorId: text("actor_id"),
    requestId: text("request_id"),
    correlationId: text("correlation_id"),
    traceId: text("trace_id"),
    causationId: text("causation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("balance_holds_subject_ref_uq").on(
      t.bookId,
      t.subjectType,
      t.subjectId,
      t.currency,
      t.holdRef,
    ),
    index("balance_holds_state_created_idx").on(t.state, t.createdAt),
  ],
);

export const balanceEvents = pgTable(
  "balance_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    currency: text("currency").notNull(),
    eventType: text("event_type").notNull(),
    holdRef: text("hold_ref"),
    operationId: uuid("operation_id").references(() => ledgerOperations.id, {
      onDelete: "set null",
    }),
    deltaLedgerBalance: bigint("delta_ledger_balance", { mode: "bigint" })
      .notNull()
      .default(0n),
    deltaAvailable: bigint("delta_available", { mode: "bigint" })
      .notNull()
      .default(0n),
    deltaReserved: bigint("delta_reserved", { mode: "bigint" })
      .notNull()
      .default(0n),
    deltaPending: bigint("delta_pending", { mode: "bigint" })
      .notNull()
      .default(0n),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    actorId: text("actor_id"),
    requestId: text("request_id"),
    correlationId: text("correlation_id"),
    traceId: text("trace_id"),
    causationId: text("causation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("balance_events_subject_created_idx").on(
      t.bookId,
      t.subjectType,
      t.subjectId,
      t.currency,
      t.createdAt,
    ),
    uniqueIndex("balance_events_operation_subject_uq").on(
      t.operationId,
      t.subjectType,
      t.subjectId,
      t.currency,
      t.eventType,
    ),
  ],
);

export const balanceProjectorCursors = pgTable("balance_projector_cursors", {
  workerKey: text("worker_key").primaryKey(),
  lastPostedAt: timestamp("last_posted_at", { withTimezone: true }),
  lastOperationId: uuid("last_operation_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdateFn(() => new Date()),
});

export type BalancePosition = typeof balancePositions.$inferSelect;
export type BalancePositionInsert = typeof balancePositions.$inferInsert;
export type BalanceHold = typeof balanceHolds.$inferSelect;
export type BalanceHoldInsert = typeof balanceHolds.$inferInsert;
export type BalanceEvent = typeof balanceEvents.$inferSelect;
export type BalanceEventInsert = typeof balanceEvents.$inferInsert;
export type BalanceProjectorCursor =
  typeof balanceProjectorCursors.$inferSelect;
