import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type Book = typeof books.$inferSelect;
export type BookInsert = typeof books.$inferInsert;

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
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
      .on(t.ownerId)
      .where(sql`${t.isDefault} = true`),
    index("books_owner_idx").on(t.ownerId),
    index("books_owner_default_idx").on(t.ownerId, t.isDefault),
  ],
);
