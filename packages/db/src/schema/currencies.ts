import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export type Currency = typeof currencies.$inferSelect;
export type CurrencyInsert = typeof currencies.$inferInsert;

export const currencies = pgTable(
    "currencies",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: text("name").notNull(),
        code: text("code").notNull(),
        symbol: text("symbol").notNull(),
        precision: integer("precision").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
    },
    (t) => [
        uniqueIndex("currencies_code_uq").on(t.code),
        check("currencies_precision_positive", sql`${t.precision} > 0`),
    ],
);