import { relations, sql } from "drizzle-orm";
import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";

import { opsAgents } from "./agents";
import { opsDeals } from "./deals";

// --- ops_agent_bonus (was: agent_bonus) ---

export const opsAgentBonus = pgTable("ops_agent_bonus", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => opsAgents.id),
  dealId: integer("deal_id")
    .notNull()
    .references(() => opsDeals.id, { onDelete: "cascade" }),
  commission: text("commission").notNull(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const opsAgentBonusRelations = relations(
  opsAgentBonus,
  ({ one }) => ({
    agent: one(opsAgents, {
      fields: [opsAgentBonus.agentId],
      references: [opsAgents.id],
    }),
    deal: one(opsDeals, {
      fields: [opsAgentBonus.dealId],
      references: [opsDeals.id],
    }),
  }),
);
