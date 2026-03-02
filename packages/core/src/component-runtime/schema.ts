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

export type CoreComponentState = "enabled" | "disabled";
export type CoreComponentScopeType = "global" | "book";

export const coreComponentStates = pgTable(
  "core_component_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: text("component_id").notNull(),
    scopeType: text("scope_type").$type<CoreComponentScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),
    state: text("state").$type<CoreComponentState>().notNull(),
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
    uniqueIndex("core_component_states_scope_uq").on(
      t.componentId,
      t.scopeType,
      t.scopeId,
    ),
    index("core_component_states_component_idx").on(t.componentId),
    index("core_component_states_scope_idx").on(t.scopeType, t.scopeId),
  ],
);

export const coreComponentEvents = pgTable(
  "core_component_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: text("component_id").notNull(),
    scopeType: text("scope_type").$type<CoreComponentScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),
    previousState: text("previous_state").$type<CoreComponentState>(),
    newState: text("new_state").$type<CoreComponentState>().notNull(),
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
    index("core_component_events_component_changed_idx").on(
      t.componentId,
      t.changedAt,
    ),
    index("core_component_events_scope_changed_idx").on(
      t.scopeType,
      t.scopeId,
      t.changedAt,
    ),
  ],
);

export const coreComponentRuntimeMeta = pgTable(
  "core_component_runtime_meta",
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

export type CoreComponentStateRow = typeof coreComponentStates.$inferSelect;
export type CoreComponentStateInsert =
  typeof coreComponentStates.$inferInsert;
export type CoreComponentEvent = typeof coreComponentEvents.$inferSelect;
export type CoreComponentEventInsert =
  typeof coreComponentEvents.$inferInsert;
export type CoreComponentRuntimeMeta =
  typeof coreComponentRuntimeMeta.$inferSelect;
export type CoreComponentRuntimeMetaInsert =
  typeof coreComponentRuntimeMeta.$inferInsert;

export const schema = {
  coreComponentStates,
  coreComponentEvents,
  coreComponentRuntimeMeta,
};
