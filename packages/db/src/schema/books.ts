import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { counterparties } from "./treasury/counterparties";

export type Book = typeof books.$inferSelect;
export type BookInsert = typeof books.$inferInsert;

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    counterpartyId: uuid("counterparty_id").references(
      () => counterparties.id,
      {
        onDelete: "set null",
      },
    ),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("books_code_uq").on(t.code),
    index("books_counterparty_idx").on(t.counterpartyId),
    index("books_counterparty_default_idx").on(t.counterpartyId, t.isDefault),
  ],
);
