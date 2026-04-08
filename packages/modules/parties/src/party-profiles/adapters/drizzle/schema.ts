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

export const partyProfiles = pgTable(
  "party_profiles",
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
    businessActivityCode: text("business_activity_code"),
    businessActivityText: text("business_activity_text"),
    businessActivityTextI18n: jsonb("business_activity_text_i18n").$type<LocaleTextMap>(),
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
      "party_profiles_owner_chk",
      sql`(
        ${table.organizationId} is not null
        and ${table.counterpartyId} is null
      ) or (
        ${table.counterpartyId} is not null
        and ${table.organizationId} is null
      )`,
    ),
    uniqueIndex("party_profiles_organization_uq").on(
      table.organizationId,
    ),
    uniqueIndex("party_profiles_counterparty_uq").on(
      table.counterpartyId,
    ),
  ],
);

export const partyIdentifiers = pgTable(
  "party_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyProfileId: uuid("party_profile_id")
      .notNull()
      .references(() => partyProfiles.id, { onDelete: "cascade" }),
    scheme: text("scheme").notNull(),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("party_identifiers_profile_idx").on(table.partyProfileId),
    uniqueIndex("party_identifiers_scheme_uq").on(
      table.partyProfileId,
      table.scheme,
    ),
  ],
);

export const partyAddresses = pgTable(
  "party_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyProfileId: uuid("party_profile_id")
      .notNull()
      .references(() => partyProfiles.id, { onDelete: "cascade" }),
    countryCode: partyCountryCodeEnum("country_code"),
    postalCode: text("postal_code"),
    city: text("city"),
    cityI18n: jsonb("city_i18n").$type<LocaleTextMap>(),
    streetAddress: text("street_address"),
    streetAddressI18n: jsonb("street_address_i18n").$type<LocaleTextMap>(),
    addressDetails: text("address_details"),
    addressDetailsI18n: jsonb("address_details_i18n").$type<LocaleTextMap>(),
    fullAddress: text("full_address"),
    fullAddressI18n: jsonb("full_address_i18n").$type<LocaleTextMap>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [uniqueIndex("party_addresses_profile_uq").on(table.partyProfileId)],
);

export const partyContacts = pgTable(
  "party_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyProfileId: uuid("party_profile_id")
      .notNull()
      .references(() => partyProfiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
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
    index("party_contacts_profile_idx").on(table.partyProfileId),
    uniqueIndex("party_contacts_primary_uq")
      .on(table.partyProfileId, table.type)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const partyRepresentatives = pgTable(
  "party_representatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyProfileId: uuid("party_profile_id")
      .notNull()
      .references(() => partyProfiles.id, { onDelete: "cascade" }),
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
    index("party_representatives_profile_idx").on(table.partyProfileId),
    uniqueIndex("party_representatives_primary_uq")
      .on(table.partyProfileId, table.role)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const partyLicenses = pgTable(
  "party_licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partyProfileId: uuid("party_profile_id")
      .notNull()
      .references(() => partyProfiles.id, { onDelete: "cascade" }),
    licenseType: text("license_type").notNull(),
    licenseNumber: text("license_number").notNull(),
    issuedBy: text("issued_by"),
    issuedByI18n: jsonb("issued_by_i18n").$type<LocaleTextMap>(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    activityCode: text("activity_code"),
    activityText: text("activity_text"),
    activityTextI18n: jsonb("activity_text_i18n").$type<LocaleTextMap>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("party_licenses_profile_idx").on(table.partyProfileId),
    uniqueIndex("party_licenses_value_uq").on(
      table.partyProfileId,
      table.licenseType,
      table.licenseNumber,
    ),
  ],
);

export const schema = {
  partyProfiles,
  partyIdentifiers,
  partyAddresses,
  partyContacts,
  partyRepresentatives,
  partyLicenses,
};
