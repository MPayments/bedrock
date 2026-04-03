import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { COUNTRY_ALPHA2_CODES } from "@bedrock/shared/reference-data/countries/contracts";

import { PARTY_KIND_VALUES } from "../../domain/party-kind";

export const ledgerBooks = ledgerSchema.books;

export const partyKindEnum = pgEnum("party_kind", PARTY_KIND_VALUES);

export const partyCountryCodeEnum = pgEnum(
  "party_country_code",
  COUNTRY_ALPHA2_CODES,
);

export interface OrganizationLocalizedText {
  ru?: string | null;
  en?: string | null;
}

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id"),
  shortName: text("short_name").notNull(),
  fullName: text("full_name").notNull(),
  description: text("description"),
  country: text("country"),
  kind: partyKindEnum("kind").notNull().default("legal_entity"),
  isActive: boolean("is_active").notNull().default(true),
  nameI18n: jsonb("name_i18n").$type<OrganizationLocalizedText>(),
  orgType: text("org_type"),
  orgTypeI18n: jsonb("org_type_i18n").$type<OrganizationLocalizedText>(),
  countryI18n: jsonb("country_i18n").$type<OrganizationLocalizedText>(),
  city: text("city"),
  cityI18n: jsonb("city_i18n").$type<OrganizationLocalizedText>(),
  address: text("address"),
  addressI18n: jsonb("address_i18n").$type<OrganizationLocalizedText>(),
  inn: text("inn"),
  taxId: text("tax_id"),
  kpp: text("kpp"),
  ogrn: text("ogrn"),
  oktmo: text("oktmo"),
  okpo: text("okpo"),
  directorName: text("director_name"),
  directorNameI18n: jsonb("director_name_i18n").$type<OrganizationLocalizedText>(),
  directorPosition: text("director_position"),
  directorPositionI18n: jsonb("director_position_i18n").$type<OrganizationLocalizedText>(),
  directorBasis: text("director_basis"),
  directorBasisI18n: jsonb("director_basis_i18n").$type<OrganizationLocalizedText>(),
  signatureKey: text("signature_key"),
  sealKey: text("seal_key"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdateFn(() => new Date()),
});

export const schema = {
  organizations,
};

export type OrganizationRow = typeof organizations.$inferSelect;
