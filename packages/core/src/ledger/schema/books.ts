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

import { counterparties } from "../../counterparties/schema";

export type Book = typeof books.$inferSelect;
export type BookInsert = typeof books.$inferInsert;

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    counterpartyId: uuid("counterparty_id")
      .notNull()
      .references(() => counterparties.id),
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
    uniqueIndex("books_default_owner_uq")
      .on(t.counterpartyId)
      .where(sql`${t.isDefault} = true`),
    index("books_counterparty_idx").on(t.counterpartyId),
    index("books_counterparty_default_idx").on(t.counterpartyId, t.isDefault),
  ],
);
