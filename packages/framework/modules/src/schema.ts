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

export type CoreModuleState = "enabled" | "disabled";
export type CoreModuleScopeType = "global" | "book";

export const coreModuleStates = pgTable(
  "core_module_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: text("module_id").notNull(),
    scopeType: text("scope_type").$type<CoreModuleScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),
    state: text("state").$type<CoreModuleState>().notNull(),
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
    uniqueIndex("core_module_states_scope_uq").on(
      t.moduleId,
      t.scopeType,
      t.scopeId,
    ),
    index("core_module_states_module_idx").on(t.moduleId),
    index("core_module_states_scope_idx").on(t.scopeType, t.scopeId),
  ],
);

export const coreModuleEvents = pgTable(
  "core_module_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: text("module_id").notNull(),
    scopeType: text("scope_type").$type<CoreModuleScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),
    previousState: text("previous_state").$type<CoreModuleState>(),
    newState: text("new_state").$type<CoreModuleState>().notNull(),
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
    index("core_module_events_module_changed_idx").on(
      t.moduleId,
      t.changedAt,
    ),
    index("core_module_events_scope_changed_idx").on(
      t.scopeType,
      t.scopeId,
      t.changedAt,
    ),
  ],
);

export const coreModuleRuntimeMeta = pgTable(
  "core_module_runtime_meta",
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

export type CoreModuleStateRow = typeof coreModuleStates.$inferSelect;
export type CoreModuleStateInsert =
  typeof coreModuleStates.$inferInsert;
export type CoreModuleEvent = typeof coreModuleEvents.$inferSelect;
export type CoreModuleEventInsert =
  typeof coreModuleEvents.$inferInsert;
export type CoreModuleRuntimeMeta =
  typeof coreModuleRuntimeMeta.$inferSelect;
export type CoreModuleRuntimeMetaInsert =
  typeof coreModuleRuntimeMeta.$inferInsert;

export const schema = {
  coreModuleStates,
  coreModuleEvents,
  coreModuleRuntimeMeta,
};
