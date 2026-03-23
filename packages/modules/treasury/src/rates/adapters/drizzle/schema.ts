import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  RateSource,
  RateSourceSyncStatus,
} from "../../domain/rate-source";

export type { RateSource, RateSourceSyncStatus } from "../../domain/rate-source";

export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull().default("manual"),
    baseCurrencyId: uuid("base_currency_id").notNull(),
    quoteCurrencyId: uuid("quote_currency_id").notNull(),
    rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
    rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("fx_rates_source_pair_asof_uq").on(
      table.source,
      table.baseCurrencyId,
      table.quoteCurrencyId,
      table.asOf,
    ),
    index("fx_rates_pair_asof_idx").on(
      table.baseCurrencyId,
      table.quoteCurrencyId,
      table.asOf,
    ),
    index("fx_rates_asof_idx").on(table.asOf),
    index("fx_rates_source_asof_idx").on(table.source, table.asOf),
  ],
);

export const fxRateSources = pgTable("fx_rate_sources", {
  source: text("source").$type<RateSource>().primaryKey(),
  ttlSeconds: integer("ttl_seconds").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
  lastStatus: text("last_status")
    .$type<RateSourceSyncStatus>()
    .notNull()
    .default("idle"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdateFn(() => new Date()),
});

export type Rate = typeof fxRates.$inferSelect;
export type RateInsert = typeof fxRates.$inferInsert;
export type RateSourceRow = typeof fxRateSources.$inferSelect;
