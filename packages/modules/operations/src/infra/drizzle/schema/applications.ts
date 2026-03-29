import { relations, sql } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "@bedrock/iam/schema";
import { counterparties } from "@bedrock/parties/schema";

import { opsClients } from "./clients";
import { opsApplicationStatusEnum } from "./enums";

// --- ops_applications (was: applications) ---

export const opsApplications = pgTable("ops_applications", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").references(() => user.id),
  clientId: integer("client_id")
    .notNull()
    .references(() => opsClients.id),
  counterpartyId: uuid("counterparty_id").references(() => counterparties.id),
  status: opsApplicationStatusEnum("status").notNull().default("created"),
  reason: text("reason"),
  comment: text("comment"),
  requestedAmount: text("requested_amount"),
  requestedCurrency: text("requested_currency"),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const opsApplicationsRelations = relations(
  opsApplications,
  ({ one }) => ({
    client: one(opsClients, {
      fields: [opsApplications.clientId],
      references: [opsClients.id],
    }),
    counterparty: one(counterparties, {
      fields: [opsApplications.counterpartyId],
      references: [counterparties.id],
    }),
    agent: one(user, {
      fields: [opsApplications.agentId],
      references: [user.id],
    }),
  }),
);
