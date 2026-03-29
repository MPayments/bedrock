import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { counterparties, customers } from "@bedrock/parties/schema";
import { user } from "@bedrock/platform/auth-model/schema";

import type { LocalizedText } from "./agents";
import { opsSubAgents } from "./agents";
import { opsContracts } from "./contracts";

// --- ops_clients (was: clients) ---

export const opsClients = pgTable("ops_clients", {
  id: serial("id").primaryKey(),
  orgName: text("org_name").notNull(),
  orgNameI18n: jsonb("org_name_i18n").$type<LocalizedText>(),
  orgType: text("org_type"),
  orgTypeI18n: jsonb("org_type_i18n").$type<LocalizedText>(),
  directorName: text("director_name"),
  directorNameI18n: jsonb("director_name_i18n").$type<LocalizedText>(),
  position: text("position"),
  positionI18n: jsonb("position_i18n").$type<LocalizedText>(),
  directorBasis: text("director_basis"),
  directorBasisI18n: jsonb("director_basis_i18n").$type<LocalizedText>(),
  address: text("address"),
  addressI18n: jsonb("address_i18n").$type<LocalizedText>(),
  email: text("email"),
  phone: text("phone"),
  inn: text("inn"),
  kpp: text("kpp"),
  ogrn: text("ogrn"),
  oktmo: text("oktmo"),
  okpo: text("okpo"),
  bankName: text("bank_name"),
  bankNameI18n: jsonb("bank_name_i18n").$type<LocalizedText>(),
  bankAddress: text("bank_address"),
  bankAddressI18n: jsonb("bank_address_i18n").$type<LocalizedText>(),
  account: text("account"),
  bic: text("bic"),
  corrAccount: text("corr_account"),
  bankCountry: text("bank_country"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  contractId: integer("contract_id").references(() => opsContracts.id),
  subAgentId: integer("sub_agent_id").references(() => opsSubAgents.id),
  userId: text("user_id").references(() => user.id),
  // FK bridge to bedrock parties
  counterpartyId: uuid("counterparty_id").references(() => counterparties.id),
  customerId: uuid("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// --- ops_client_documents (was: client_documents) ---

export const opsClientDocuments = pgTable("ops_client_documents", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => opsClients.id, { onDelete: "cascade" }),
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

export const opsClientsRelations = relations(opsClients, ({ one, many }) => ({
  contract: one(opsContracts, {
    fields: [opsClients.contractId],
    references: [opsContracts.id],
  }),
  subAgent: one(opsSubAgents, {
    fields: [opsClients.subAgentId],
    references: [opsSubAgents.id],
  }),
  user: one(user, {
    fields: [opsClients.userId],
    references: [user.id],
  }),
  customer: one(customers, {
    fields: [opsClients.customerId],
    references: [customers.id],
  }),
  documents: many(opsClientDocuments),
}));

export const opsClientDocumentsRelations = relations(
  opsClientDocuments,
  ({ one }) => ({
    client: one(opsClients, {
      fields: [opsClientDocuments.clientId],
      references: [opsClients.id],
    }),
    uploader: one(user, {
      fields: [opsClientDocuments.uploadedBy],
      references: [user.id],
    }),
  }),
);
