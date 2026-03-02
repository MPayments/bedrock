import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { operationalAccounts } from "./accounts";
import { bookAccountInstances, books } from "../../ledger/schema";

export const operationalAccountBindings = pgTable(
  "operational_account_bindings",
  {
    operationalAccountId: uuid("operational_account_id")
      .primaryKey()
      .references(() => operationalAccounts.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    bookAccountInstanceId: uuid("book_account_instance_id")
      .notNull()
      .references(() => bookAccountInstances.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("operational_account_binding_book_idx").on(t.bookId),
    index("operational_account_binding_instance_idx").on(
      t.bookAccountInstanceId,
    ),
  ],
);

export type OperationalAccountBinding =
  typeof operationalAccountBindings.$inferSelect;
export type OperationalAccountBindingInsert =
  typeof operationalAccountBindings.$inferInsert;
