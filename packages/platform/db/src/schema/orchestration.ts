import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type RoutingDirection = "payin" | "payout";

export const routingRules = pgTable(
  "routing_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    direction: text("direction").$type<RoutingDirection>(),
    corridor: text("corridor"),
    currency: text("currency"),
    countryFrom: text("country_from"),
    countryTo: text("country_to"),
    amountMinMinor: bigint("amount_min_minor", { mode: "bigint" }),
    amountMaxMinor: bigint("amount_max_minor", { mode: "bigint" }),
    riskMin: integer("risk_min"),
    riskMax: integer("risk_max"),
    preferredProviders: jsonb("preferred_providers").$type<string[] | null>(),
    degradationOrder: jsonb("degradation_order").$type<string[] | null>(),
    weightCost: integer("weight_cost").notNull().default(40),
    weightFx: integer("weight_fx").notNull().default(20),
    weightSla: integer("weight_sla").notNull().default(20),
    weightHealth: integer("weight_health").notNull().default(20),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("routing_rules_name_uq").on(t.name),
    index("routing_rules_enabled_priority_idx").on(t.enabled, t.priority),
    index("routing_rules_match_idx").on(
      t.enabled,
      t.direction,
      t.corridor,
      t.currency,
    ),
  ],
);

export const providerCorridors = pgTable(
  "provider_corridors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerCode: text("provider_code").notNull(),
    corridor: text("corridor").notNull(),
    direction: text("direction").$type<RoutingDirection>().notNull(),
    currency: text("currency").notNull(),
    countryFrom: text("country_from"),
    countryTo: text("country_to"),
    supportsWebhooks: boolean("supports_webhooks").notNull().default(true),
    pollingRequired: boolean("polling_required").notNull().default(false),
    slaScore: integer("sla_score").notNull().default(50),
    enabled: boolean("enabled").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex(
      "provider_corridors_provider_corridor_direction_currency_uq",
    ).on(t.providerCode, t.corridor, t.direction, t.currency),
    index("provider_corridors_enabled_idx").on(
      t.enabled,
      t.providerCode,
      t.corridor,
      t.direction,
      t.currency,
    ),
  ],
);

export const providerFeeSchedules = pgTable(
  "provider_fee_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerCode: text("provider_code").notNull(),
    corridor: text("corridor").notNull(),
    currency: text("currency").notNull(),
    fixedFeeMinor: bigint("fixed_fee_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    bps: integer("bps").notNull().default(0),
    fxMarkupBps: integer("fx_markup_bps").notNull().default(0),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("provider_fee_schedules_lookup_idx").on(
      t.providerCode,
      t.corridor,
      t.currency,
      t.effectiveFrom,
    ),
  ],
);

export const providerLimits = pgTable(
  "provider_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerCode: text("provider_code").notNull(),
    corridor: text("corridor").notNull(),
    currency: text("currency").notNull(),
    minAmountMinor: bigint("min_amount_minor", { mode: "bigint" }).notNull(),
    maxAmountMinor: bigint("max_amount_minor", { mode: "bigint" }).notNull(),
    dailyVolumeMinor: bigint("daily_volume_minor", { mode: "bigint" }),
    dailyCount: integer("daily_count"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("provider_limits_provider_corridor_currency_uq").on(
      t.providerCode,
      t.corridor,
      t.currency,
    ),
    index("provider_limits_enabled_idx").on(
      t.enabled,
      t.providerCode,
      t.corridor,
    ),
  ],
);

export const orchestrationScopeOverrides = pgTable(
  "orchestration_scope_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: text("scope_type").notNull().default("book"),
    scopeId: text("scope_id").notNull(),
    routingRuleId: uuid("routing_rule_id")
      .notNull()
      .references(() => routingRules.id, { onDelete: "cascade" }),
    overrideConfig: jsonb("override_config")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("orchestration_scope_overrides_scope_rule_uq").on(
      t.scopeType,
      t.scopeId,
      t.routingRuleId,
    ),
    index("orchestration_scope_overrides_scope_idx").on(t.scopeType, t.scopeId),
  ],
);

export type RoutingRule = typeof routingRules.$inferSelect;
export type RoutingRuleInsert = typeof routingRules.$inferInsert;
export type ProviderCorridor = typeof providerCorridors.$inferSelect;
export type ProviderCorridorInsert = typeof providerCorridors.$inferInsert;
export type ProviderFeeSchedule = typeof providerFeeSchedules.$inferSelect;
export type ProviderFeeScheduleInsert =
  typeof providerFeeSchedules.$inferInsert;
export type ProviderLimit = typeof providerLimits.$inferSelect;
export type ProviderLimitInsert = typeof providerLimits.$inferInsert;
export type OrchestrationScopeOverride =
  typeof orchestrationScopeOverrides.$inferSelect;
export type OrchestrationScopeOverrideInsert =
  typeof orchestrationScopeOverrides.$inferInsert;
