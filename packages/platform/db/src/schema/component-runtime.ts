import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type PlatformComponentState = "enabled" | "disabled";
export type PlatformComponentScopeType = "global" | "book";

export const platformComponentStates = pgTable(
  "platform_component_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: text("component_id").notNull(),
    scopeType: text("scope_type").$type<PlatformComponentScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),
    state: text("state").$type<PlatformComponentState>().notNull(),
    reason: text("reason").notNull(),
    retryAfterSec: integer("retry_after_sec").notNull().default(300),
    version: integer("version").notNull().default(1),
    changedBy: text("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("platform_component_states_scope_uq").on(
      t.componentId,
      t.scopeType,
      t.scopeId,
    ),
    index("platform_component_states_component_idx").on(t.componentId),
    index("platform_component_states_scope_idx").on(t.scopeType, t.scopeId),
  ],
);

export const platformComponentEvents = pgTable(
  "platform_component_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: text("component_id").notNull(),
    scopeType: text("scope_type").$type<PlatformComponentScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),
    previousState: text("previous_state").$type<PlatformComponentState>(),
    newState: text("new_state").$type<PlatformComponentState>().notNull(),
    reason: text("reason").notNull(),
    retryAfterSec: integer("retry_after_sec").notNull().default(300),
    changedBy: text("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    requestId: text("request_id"),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
  },
  (t) => [
    index("platform_component_events_component_changed_idx").on(
      t.componentId,
      t.changedAt,
    ),
    index("platform_component_events_scope_changed_idx").on(
      t.scopeType,
      t.scopeId,
      t.changedAt,
    ),
  ],
);

export const platformComponentRuntimeMeta = pgTable(
  "platform_component_runtime_meta",
  {
    id: integer("id").primaryKey(),
    stateEpoch: bigint("state_epoch", { mode: "bigint" })
      .notNull()
      .default(sql`1`),
    manifestChecksum: text("manifest_checksum").notNull(),
    manifestSeenVersion: integer("manifest_seen_version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
);

export type PlatformComponentStateRow = typeof platformComponentStates.$inferSelect;
export type PlatformComponentStateInsert =
  typeof platformComponentStates.$inferInsert;
export type PlatformComponentEvent = typeof platformComponentEvents.$inferSelect;
export type PlatformComponentEventInsert =
  typeof platformComponentEvents.$inferInsert;
export type PlatformComponentRuntimeMeta =
  typeof platformComponentRuntimeMeta.$inferSelect;
export type PlatformComponentRuntimeMetaInsert =
  typeof platformComponentRuntimeMeta.$inferInsert;
