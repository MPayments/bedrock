import { relations, sql } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";

import { user } from "@bedrock/iam/schema";

import type { LocalizedText } from "./agents";
import { opsAgentOrganizationBankDetails } from "./agents";
import { opsApplications } from "./applications";
import { opsCalculations } from "./calculations";
import { opsDealStatusEnum } from "./enums";

// --- ops_deals (was: deals) ---

export const opsDeals = pgTable("ops_deals", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id")
    .notNull()
    .references(() => opsApplications.id),
  calculationId: integer("calculation_id")
    .notNull()
    .references(() => opsCalculations.id),
  agentOrganizationBankDetailsId: integer(
    "agent_organization_bank_details_id",
  )
    .notNull()
    .references(() => opsAgentOrganizationBankDetails.id),
  status: opsDealStatusEnum("status")
    .notNull()
    .default("preparing_documents"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: text("invoice_date"),
  companyName: text("company_name"),
  companyNameI18n: jsonb("company_name_i18n").$type<LocalizedText>(),
  bankName: text("bank_name"),
  bankNameI18n: jsonb("bank_name_i18n").$type<LocalizedText>(),
  account: text("account"),
  swiftCode: text("swift_code"),
  contractDate: text("contract_date"),
  contractNumber: text("contract_number"),
  costPrice: text("cost_price"),
  closedAt: text("closed_at"),
  comment: text("comment"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// --- ops_deal_documents (was: deal_documents) ---

export const opsDealDocuments = pgTable("ops_deal_documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id")
    .notNull()
    .references(() => opsDeals.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  s3Key: text("s3_key").notNull(),
  uploadedBy: text("uploaded_by")
    .references(() => user.id),
  description: text("description"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// --- Relations ---

export const opsDealsRelations = relations(opsDeals, ({ one, many }) => ({
  application: one(opsApplications, {
    fields: [opsDeals.applicationId],
    references: [opsApplications.id],
  }),
  calculation: one(opsCalculations, {
    fields: [opsDeals.calculationId],
    references: [opsCalculations.id],
  }),
  organizationBank: one(opsAgentOrganizationBankDetails, {
    fields: [opsDeals.agentOrganizationBankDetailsId],
    references: [opsAgentOrganizationBankDetails.id],
  }),
  documents: many(opsDealDocuments),
}));

export const opsDealDocumentsRelations = relations(
  opsDealDocuments,
  ({ one }) => ({
    deal: one(opsDeals, {
      fields: [opsDealDocuments.dealId],
      references: [opsDeals.id],
    }),
    uploader: one(user, {
      fields: [opsDealDocuments.uploadedBy],
      references: [user.id],
    }),
  }),
);
