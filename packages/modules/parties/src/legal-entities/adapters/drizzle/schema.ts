import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { LocaleTextMap } from "../../../shared/domain/locale-map";
import {
  organizations,
  partyCountryCodeEnum,
} from "../../../organizations/adapters/drizzle/schema";
import { counterparties } from "../../../counterparties/adapters/drizzle/schema";

export const partyLegalProfiles = pgTable(
  "party_legal_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    counterpartyId: uuid("counterparty_id").references(() => counterparties.id, {
      onDelete: "cascade",
    }),
    fullName: text("full_name").notNull(),
    shortName: text("short_name").notNull(),
    fullNameI18n: jsonb("full_name_i18n").$type<LocaleTextMap>(),
    shortNameI18n: jsonb("short_name_i18n").$type<LocaleTextMap>(),
    legalFormCode: text("legal_form_code"),
    legalFormLabel: text("legal_form_label"),
    legalFormLabelI18n: jsonb("legal_form_label_i18n").$type<LocaleTextMap>(),
    countryCode: partyCountryCodeEnum("country_code"),
    jurisdictionCode: text("jurisdiction_code"),
    registrationAuthority: text("registration_authority"),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    businessActivityCode: text("business_activity_code"),
    businessActivityText: text("business_activity_text"),
    status: text("status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    check(
      "party_legal_profiles_owner_chk",
      sql`(
        ${table.organizationId} is not null
        and ${table.counterpartyId} is null
      ) or (
        ${table.counterpartyId} is not null
        and ${table.organizationId} is null
      )`,
    ),
    uniqueIndex("party_legal_profiles_organization_uq").on(
      table.organizationId,
    ),
    uniqueIndex("party_legal_profiles_counterparty_uq").on(
      table.counterpartyId,
    ),
  ],
);

export const partyLegalIdentifiers = pgTable(
  "party_legal_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyLegalProfileId: uuid("party_legal_profile_id")
      .notNull()
      .references(() => partyLegalProfiles.id, { onDelete: "cascade" }),
    scheme: text("scheme").notNull(),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    jurisdictionCode: text("jurisdiction_code"),
    issuer: text("issuer"),
    isPrimary: boolean("is_primary").notNull().default(false),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("party_legal_identifiers_profile_idx").on(table.partyLegalProfileId),
    uniqueIndex("party_legal_identifiers_value_uq").on(
      table.partyLegalProfileId,
      table.scheme,
      table.normalizedValue,
    ),
    uniqueIndex("party_legal_identifiers_primary_uq")
      .on(table.partyLegalProfileId, table.scheme)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const partyAddresses = pgTable(
  "party_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyLegalProfileId: uuid("party_legal_profile_id")
      .notNull()
      .references(() => partyLegalProfiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    label: text("label"),
    countryCode: partyCountryCodeEnum("country_code"),
    jurisdictionCode: text("jurisdiction_code"),
    postalCode: text("postal_code"),
    city: text("city"),
    line1: text("line_1"),
    line2: text("line_2"),
    rawText: text("raw_text"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("party_addresses_profile_idx").on(table.partyLegalProfileId),
    uniqueIndex("party_addresses_primary_uq")
      .on(table.partyLegalProfileId, table.type)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const partyContacts = pgTable(
  "party_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyLegalProfileId: uuid("party_legal_profile_id")
      .notNull()
      .references(() => partyLegalProfiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    label: text("label"),
    value: text("value").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("party_contacts_profile_idx").on(table.partyLegalProfileId),
    uniqueIndex("party_contacts_primary_uq")
      .on(table.partyLegalProfileId, table.type)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const partyRepresentatives = pgTable(
  "party_representatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyLegalProfileId: uuid("party_legal_profile_id")
      .notNull()
      .references(() => partyLegalProfiles.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    fullName: text("full_name").notNull(),
    fullNameI18n: jsonb("full_name_i18n").$type<LocaleTextMap>(),
    title: text("title"),
    titleI18n: jsonb("title_i18n").$type<LocaleTextMap>(),
    basisDocument: text("basis_document"),
    basisDocumentI18n: jsonb("basis_document_i18n").$type<LocaleTextMap>(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("party_representatives_profile_idx").on(table.partyLegalProfileId),
    uniqueIndex("party_representatives_primary_uq")
      .on(table.partyLegalProfileId, table.role)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const partyLicenses = pgTable(
  "party_licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyLegalProfileId: uuid("party_legal_profile_id")
      .notNull()
      .references(() => partyLegalProfiles.id, { onDelete: "cascade" }),
    licenseType: text("license_type").notNull(),
    licenseNumber: text("license_number").notNull(),
    issuedBy: text("issued_by"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    activityCode: text("activity_code"),
    activityText: text("activity_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("party_licenses_profile_idx").on(table.partyLegalProfileId),
    uniqueIndex("party_licenses_value_uq").on(
      table.partyLegalProfileId,
      table.licenseType,
      table.licenseNumber,
    ),
  ],
);

export const schema = {
  partyLegalProfiles,
  partyLegalIdentifiers,
  partyAddresses,
  partyContacts,
  partyRepresentatives,
  partyLicenses,
};
