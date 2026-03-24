import { relations, sql } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { opsAgents } from "./agents";
import {
  opsActivityActionEnum,
  opsActivityEntityEnum,
  opsActivitySourceEnum,
} from "./enums";

// --- ops_activity_log (was: activity_log) ---

export const opsActivityLog = pgTable("ops_activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => opsAgents.id),
  action: opsActivityActionEnum("action").notNull(),
  entityType: opsActivityEntityEnum("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  entityTitle: text("entity_title"),
  source: opsActivitySourceEnum("source").notNull().default("web"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const opsActivityLogRelations = relations(
  opsActivityLog,
  ({ one }) => ({
    user: one(opsAgents, {
      fields: [opsActivityLog.userId],
      references: [opsAgents.id],
    }),
  }),
);
