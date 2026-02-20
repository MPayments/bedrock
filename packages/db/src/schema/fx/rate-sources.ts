import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type FxRateSource = "cbr" | "investing";
export type FxRateSourceSyncStatus = "idle" | "ok" | "error";
export type FxRateSourceRow = typeof fxRateSources.$inferSelect;

export const fxRateSources = pgTable("fx_rate_sources", {
    source: text("source").$type<FxRateSource>().primaryKey(),
    ttlSeconds: integer("ttl_seconds").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    lastStatus: text("last_status").$type<FxRateSourceSyncStatus>().notNull().default("idle"),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
});
