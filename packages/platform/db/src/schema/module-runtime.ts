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

export type PlatformModuleState = "enabled" | "disabled";
export type PlatformModuleScopeType = "global" | "book";

export const platformModuleStates = pgTable(
  "platform_module_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: text("module_id").notNull(),
    scopeType: text("scope_type").$type<PlatformModuleScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),
    state: text("state").$type<PlatformModuleState>().notNull(),
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
    uniqueIndex("platform_module_states_scope_uq").on(
      t.moduleId,
      t.scopeType,
      t.scopeId,
    ),
    index("platform_module_states_module_idx").on(t.moduleId),
    index("platform_module_states_scope_idx").on(t.scopeType, t.scopeId),
  ],
);

export const platformModuleEvents = pgTable(
  "platform_module_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: text("module_id").notNull(),
    scopeType: text("scope_type").$type<PlatformModuleScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),
    previousState: text("previous_state").$type<PlatformModuleState>(),
    newState: text("new_state").$type<PlatformModuleState>().notNull(),
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
    index("platform_module_events_module_changed_idx").on(
      t.moduleId,
      t.changedAt,
    ),
    index("platform_module_events_scope_changed_idx").on(
      t.scopeType,
      t.scopeId,
      t.changedAt,
    ),
  ],
);

export const platformModuleRuntimeMeta = pgTable(
  "platform_module_runtime_meta",
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

export type PlatformModuleStateRow = typeof platformModuleStates.$inferSelect;
export type PlatformModuleStateInsert =
  typeof platformModuleStates.$inferInsert;
export type PlatformModuleEvent = typeof platformModuleEvents.$inferSelect;
export type PlatformModuleEventInsert =
  typeof platformModuleEvents.$inferInsert;
export type PlatformModuleRuntimeMeta =
  typeof platformModuleRuntimeMeta.$inferSelect;
export type PlatformModuleRuntimeMetaInsert =
  typeof platformModuleRuntimeMeta.$inferInsert;
