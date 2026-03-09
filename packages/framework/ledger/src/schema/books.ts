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

export type Book = typeof books.$inferSelect;
export type BookInsert = typeof books.$inferInsert;

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
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
      .on(t.organizationId)
      .where(sql`${t.isDefault} = true`),
    index("books_organization_idx").on(t.organizationId),
    index("books_organization_default_idx").on(t.organizationId, t.isDefault),
  ],
);
