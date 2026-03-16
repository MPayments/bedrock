import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";

const { bookAccountInstances, books } = ledgerSchema;

export const organizationRequisiteBindings = pgTable(
  "organization_requisite_bindings",
  {
    requisiteId: uuid("requisite_id").primaryKey(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    bookAccountInstanceId: uuid("book_account_instance_id")
      .notNull()
      .references(() => bookAccountInstances.id),
    postingAccountNo: text("posting_account_no").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("requisite_accounting_bindings_book_idx").on(table.bookId),
    index("requisite_accounting_bindings_instance_idx").on(
      table.bookAccountInstanceId,
    ),
  ],
);

export type OrganizationRequisiteBindingRow =
  typeof organizationRequisiteBindings.$inferSelect;
export type OrganizationRequisiteBindingInsert =
  typeof organizationRequisiteBindings.$inferInsert;
