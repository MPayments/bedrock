import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Упрощенная политика:
 * - marginBps: маржа в bps (1 bps = 0.01%)
 * - feeBps: комиссия в bps (в валюте FROM)
 * - ttlSeconds: сколько живет quote
 */
export const fxPolicies = pgTable(
    "fx_policies",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: text("name").notNull(),

        marginBps: integer("margin_bps").notNull().default(0),
        feeBps: integer("fee_bps").notNull().default(0),

        ttlSeconds: integer("ttl_seconds").notNull().default(600),

        isActive: boolean("is_active").notNull().default(true),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
    },
    (t) => ([
        uniqueIndex("fx_policies_name_uq").on(t.name),
    ])
);
