import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { counterpartyAccounts } from "./counterparty-accounts";
import { bookAccountInstances, books } from "../../ledger/schema";

export const counterpartyAccountBindings = pgTable(
  "counterparty_account_bindings",
  {
    counterpartyAccountId: uuid("counterparty_account_id")
      .primaryKey()
      .references(() => counterpartyAccounts.id, { onDelete: "cascade" }),
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
    index("counterparty_account_binding_book_idx").on(t.bookId),
    index("counterparty_account_binding_instance_idx").on(
      t.bookAccountInstanceId,
    ),
  ],
);

export type CounterpartyAccountBinding =
  typeof counterpartyAccountBindings.$inferSelect;
export type CounterpartyAccountBindingInsert =
  typeof counterpartyAccountBindings.$inferInsert;
