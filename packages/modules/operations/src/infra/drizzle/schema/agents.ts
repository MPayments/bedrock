import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations, requisites } from "@bedrock/parties/schema";

export interface LocalizedText {
  ru?: string | null;
  en?: string | null;
}

// --- ops_agent_organizations (was: agent_organizations) ---

export const opsAgentOrganizations = pgTable("ops_agent_organizations", {
  id: serial("id").primaryKey(),
  name: text("name"),
  nameI18n: jsonb("name_i18n").$type<LocalizedText>(),
  orgType: text("org_type"),
  orgTypeI18n: jsonb("org_type_i18n").$type<LocalizedText>(),
  country: text("country"),
  countryI18n: jsonb("country_i18n").$type<LocalizedText>(),
  city: text("city"),
  cityI18n: jsonb("city_i18n").$type<LocalizedText>(),
  address: text("address"),
  addressI18n: jsonb("address_i18n").$type<LocalizedText>(),
  inn: text("inn"),
  taxId: text("tax_id"),
  kpp: text("kpp"),
  ogrn: text("ogrn"),
  oktmo: text("oktmo"),
  okpo: text("okpo"),
  directorName: text("director_name"),
  directorNameI18n: jsonb("director_name_i18n").$type<LocalizedText>(),
  directorPosition: text("director_position"),
  directorPositionI18n: jsonb("director_position_i18n").$type<LocalizedText>(),
  directorBasis: text("director_basis"),
  directorBasisI18n: jsonb("director_basis_i18n").$type<LocalizedText>(),
  signatureKey: text("signature_key"),
  sealKey: text("seal_key"),
  isActive: boolean("is_active").default(true).notNull(),
  // FK bridge to bedrock parties
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// --- ops_agent_organization_bank_details (was: agent_organization_bank_details) ---

export const opsAgentOrganizationBankDetails = pgTable(
  "ops_agent_organization_bank_details",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => opsAgentOrganizations.id),
    name: text("name"),
    nameI18n: jsonb("name_i18n").$type<LocalizedText>(),
    bankName: text("bank_name"),
    bankNameI18n: jsonb("bank_name_i18n").$type<LocalizedText>(),
    bankAddress: text("bank_address"),
    bankAddressI18n: jsonb("bank_address_i18n").$type<LocalizedText>(),
    account: text("account"),
    bic: text("bic"),
    corrAccount: text("corr_account"),
    swiftCode: text("swift_code"),
    currencyCode: text("currency_code").default("RUB").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    // FK bridge to bedrock requisites
    requisiteId: uuid("requisite_id").references(() => requisites.id),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
);
