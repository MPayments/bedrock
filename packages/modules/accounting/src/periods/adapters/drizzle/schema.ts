import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations } from "@bedrock/parties/schema";

export type AccountingClosePackageState = "closed" | "superseded";
export type AccountingPeriodState = "closed" | "reopened";

export const accountingClosePackages = pgTable(
  "accounting_close_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    revision: integer("revision").notNull(),
    state: text("state").$type<AccountingClosePackageState>().notNull(),
    closeDocumentId: uuid("close_document_id").notNull(),
    reopenDocumentId: uuid("reopen_document_id"),
    checksum: text("checksum").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("accounting_close_packages_period_revision_uq").on(
      t.organizationId,
      t.periodStart,
      t.revision,
    ),
    index("accounting_close_packages_lookup_idx").on(
      t.organizationId,
      t.periodStart,
      t.revision,
    ),
    index("accounting_close_packages_state_idx").on(t.state, t.generatedAt),
  ],
);

export const accountingPeriodLocks = pgTable(
  "accounting_period_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
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
    uniqueIndex("accounting_period_locks_organization_period_uq").on(
      t.organizationId,
      t.periodStart,
    ),
    index("accounting_period_locks_state_period_idx").on(
      t.state,
      t.periodStart.desc(),
    ),
    index("accounting_period_locks_organization_state_idx").on(
      t.organizationId,
      t.state,
    ),
  ],
);

export type AccountingClosePackage = typeof accountingClosePackages.$inferSelect;
export type AccountingPeriodLock = typeof accountingPeriodLocks.$inferSelect;
export type AccountingPeriodLockInsert = typeof accountingPeriodLocks.$inferInsert;
