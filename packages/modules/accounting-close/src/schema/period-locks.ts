import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { counterparties } from "@bedrock/counterparties/schema";

export type AccountingPeriodState = "closed" | "reopened";

export const accountingPeriodLocks = pgTable(
  "accounting_period_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    counterpartyId: uuid("counterparty_id")
      .notNull()
      .references(() => counterparties.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    state: text("state").$type<AccountingPeriodState>().notNull().default("closed"),
    lockedByDocumentId: uuid("locked_by_document_id"),
    closeReason: text("close_reason"),
    closedBy: text("closed_by"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    reopenedBy: text("reopened_by"),
    reopenReason: text("reopen_reason"),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("accounting_period_locks_counterparty_period_uq").on(
      t.counterpartyId,
      t.periodStart,
    ),
    index("accounting_period_locks_state_period_idx").on(
      t.state,
      t.periodStart.desc(),
    ),
    index("accounting_period_locks_counterparty_state_idx").on(
      t.counterpartyId,
      t.state,
    ),
  ],
);

export type AccountingPeriodLock = typeof accountingPeriodLocks.$inferSelect;
export type AccountingPeriodLockInsert = typeof accountingPeriodLocks.$inferInsert;
