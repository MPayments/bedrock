import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { customers } from "../customers";

export const organizations = pgTable("organizations", {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id"),
    customerId: uuid("customer_id").references(() => customers.id),
    name: text("name").notNull(),
    country: text("country"),
    baseCurrency: text("base_currency").notNull().default("USD"),
    isTreasury: boolean("is_treasury").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
}, (table) => [
    check("treasury_or_customer", sql`${table.isTreasury} = true OR ${table.customerId} IS NOT NULL`),
]);
