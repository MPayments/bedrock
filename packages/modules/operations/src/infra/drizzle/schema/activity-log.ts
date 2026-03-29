import { relations, sql } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "@bedrock/iam/schema";

import {
  opsActivityActionEnum,
  opsActivityEntityEnum,
  opsActivitySourceEnum,
} from "./enums";

// --- ops_activity_log (was: activity_log) ---

export const opsActivityLog = pgTable("ops_activity_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
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
    user: one(user, {
      fields: [opsActivityLog.userId],
      references: [user.id],
    }),
  }),
);
