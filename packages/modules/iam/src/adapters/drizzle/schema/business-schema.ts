import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    tgId: bigint("tg_id", { mode: "number" }).unique(),
    userName: text("user_name"),
    tag: text("tag"),
    status: text("status").notNull().default("active"),
    isAllowed: boolean("is_allowed").notNull().default(false),
    allowedBy: text("allowed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    allowedAt: timestamp("allowed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_profiles_status_idx").on(table.status),
    index("agent_profiles_is_allowed_idx").on(table.isAllowed),
  ],
);

export const userAccessStates = pgTable(
  "user_access_states",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_access_states_banned_idx").on(table.banned)],
);

export const agentProfilesRelations = relations(agentProfiles, ({ one }) => ({
  user: one(user, {
    fields: [agentProfiles.userId],
    references: [user.id],
  }),
  allowedByUser: one(user, {
    fields: [agentProfiles.allowedBy],
    references: [user.id],
    relationName: "agent_profiles_allowed_by_user",
  }),
}));

export const userAccessStatesRelations = relations(
  userAccessStates,
  ({ one }) => ({
    user: one(user, {
      fields: [userAccessStates.userId],
      references: [user.id],
    }),
  }),
);
