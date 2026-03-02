import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalRef: text("external_ref"),
  displayName: text("display_name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdateFn(() => new Date()),
});

export const documentsRef = pgTable("documents", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id"),
});

export const schema = {
  customers,
  documentsRef,
};
