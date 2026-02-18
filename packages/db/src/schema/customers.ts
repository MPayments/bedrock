import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { organizations } from "./treasury/organizations";
import { sql } from "drizzle-orm";

export const customers = pgTable(
    "customers",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        externalRef: text("external_ref"),
        displayName: text("display_name").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    }
);
