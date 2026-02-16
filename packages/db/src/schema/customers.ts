import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { organizations } from "./treasury/organizations";
import { sql } from "drizzle-orm";

export const customers = pgTable(
    "customers",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
        externalRef: text("external_ref"),
        displayName: text("display_name").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => ([
        index("customers_org_idx").on(t.orgId)

    ])
);
