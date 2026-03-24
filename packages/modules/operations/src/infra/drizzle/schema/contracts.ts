import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import {
  opsAgentOrganizationBankDetails,
  opsAgentOrganizations,
} from "./agents";

// Forward-declared via AnyPgColumn to break circular dependency with clients
// (clients references contracts, contracts references clients)
export const opsContracts = pgTable("ops_contracts", {
  id: serial("id").primaryKey(),
  contractNumber: text("contract_number").unique(),
  contractDate: text("contract_date"),
  agentFee: text("agent_fee"),
  fixedFee: text("fixed_fee"),
  clientId: integer("client_id").notNull(),
  agentOrganizationId: integer("agent_organization_id")
    .notNull()
    .references(() => opsAgentOrganizations.id),
  agentOrganizationBankDetailsId: integer(
    "agent_organization_bank_details_id",
  )
    .notNull()
    .references(() => opsAgentOrganizationBankDetails.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const opsContractsRelations = relations(opsContracts, ({ one }) => ({
  agentOrganization: one(opsAgentOrganizations, {
    fields: [opsContracts.agentOrganizationId],
    references: [opsAgentOrganizations.id],
  }),
  agentOrganizationBank: one(opsAgentOrganizationBankDetails, {
    fields: [opsContracts.agentOrganizationBankDetailsId],
    references: [opsAgentOrganizationBankDetails.id],
  }),
}));
