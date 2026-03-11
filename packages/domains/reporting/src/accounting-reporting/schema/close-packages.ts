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

import { documents } from "@multihansa/documents/schema";

import { counterparties } from "@multihansa/parties/counterparties/schema";

export type AccountingClosePackageState = "closed" | "superseded";

export const accountingClosePackages = pgTable(
  "accounting_close_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    counterpartyId: uuid("counterparty_id")
      .notNull()
      .references(() => counterparties.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    revision: integer("revision").notNull(),
    state: text("state").$type<AccountingClosePackageState>().notNull(),
    closeDocumentId: uuid("close_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    reopenDocumentId: uuid("reopen_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
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
      t.counterpartyId,
      t.periodStart,
      t.revision,
    ),
    index("accounting_close_packages_lookup_idx").on(
      t.counterpartyId,
      t.periodStart,
      t.revision,
    ),
    index("accounting_close_packages_state_idx").on(t.state, t.generatedAt),
  ],
);

export type AccountingClosePackage = typeof accountingClosePackages.$inferSelect;

