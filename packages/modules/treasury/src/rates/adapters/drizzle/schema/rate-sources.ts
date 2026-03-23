import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type {
  RateSource,
  RateSourceSyncStatus,
} from "../../../domain/rate-source";
export type {
  RateSource,
  RateSourceSyncStatus,
} from "../../../domain/rate-source";

export type RateSourceRow = typeof fxRateSources.$inferSelect;

export const fxRateSources = pgTable("fx_rate_sources", {
    source: text("source").$type<RateSource>().primaryKey(),
    ttlSeconds: integer("ttl_seconds").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    lastStatus: text("last_status").$type<RateSourceSyncStatus>().notNull().default("idle"),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
});
