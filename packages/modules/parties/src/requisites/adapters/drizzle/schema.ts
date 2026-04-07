import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { currencies } from "@bedrock/currencies/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";

import { counterparties } from "../../../counterparties/adapters/drizzle/schema";
import { organizations } from "../../../organizations/adapters/drizzle/schema";
import { REQUISITE_OWNER_TYPE_VALUES } from "../../domain/owner";
import { REQUISITE_KIND_VALUES } from "../../domain/requisite-kind";

const { bookAccountInstances, books } = ledgerSchema;

export const requisiteOwnerTypeEnum = pgEnum(
  "requisite_owner_type",
  REQUISITE_OWNER_TYPE_VALUES,
);
export const requisiteKindEnum = pgEnum(
  "requisite_kind",
  REQUISITE_KIND_VALUES,
);

export const requisiteProviders = pgTable(
  "requisite_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: requisiteKindEnum("kind").notNull(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    country: text("country"),
    website: text("website"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("requisite_providers_kind_idx").on(table.kind),
    index("requisite_providers_country_idx").on(table.country),
  ],
);

export const requisiteProviderIdentifiers = pgTable(
  "requisite_provider_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => requisiteProviders.id, { onDelete: "cascade" }),
    scheme: text("scheme").notNull(),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
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
    index("requisite_provider_identifiers_provider_idx").on(table.providerId),
    uniqueIndex("requisite_provider_identifiers_value_uq").on(
      table.providerId,
      table.scheme,
      table.normalizedValue,
    ),
    uniqueIndex("requisite_provider_identifiers_primary_uq")
      .on(table.providerId, table.scheme)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const requisiteProviderBranches = pgTable(
  "requisite_provider_branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => requisiteProviders.id, { onDelete: "cascade" }),
    code: text("code"),
    name: text("name").notNull(),
    country: text("country"),
    postalCode: text("postal_code"),
    city: text("city"),
    line1: text("line_1"),
    line2: text("line_2"),
    rawAddress: text("raw_address"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("requisite_provider_branches_provider_idx").on(table.providerId),
    uniqueIndex("requisite_provider_branches_primary_uq")
      .on(table.providerId)
      .where(sql`${table.isPrimary} = true and ${table.archivedAt} is null`),
  ],
);

export const requisiteProviderBranchIdentifiers = pgTable(
  "requisite_provider_branch_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => requisiteProviderBranches.id, { onDelete: "cascade" }),
    scheme: text("scheme").notNull(),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
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
    index("requisite_provider_branch_identifiers_branch_idx").on(table.branchId),
    uniqueIndex("requisite_provider_branch_identifiers_value_uq").on(
      table.branchId,
      table.scheme,
      table.normalizedValue,
    ),
    uniqueIndex("requisite_provider_branch_identifiers_primary_uq")
      .on(table.branchId, table.scheme)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const requisites = pgTable(
  "requisites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: requisiteOwnerTypeEnum("owner_type").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    counterpartyId: uuid("counterparty_id").references(() => counterparties.id, {
      onDelete: "cascade",
    }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => requisiteProviders.id),
    providerBranchId: uuid("provider_branch_id").references(
      () => requisiteProviderBranches.id,
      {
        onDelete: "set null",
      },
    ),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    kind: requisiteKindEnum("kind").notNull(),
    label: text("label").notNull(),
    beneficiaryName: text("beneficiary_name"),
    beneficiaryNameLocal: text("beneficiary_name_local"),
    beneficiaryAddress: text("beneficiary_address"),
    paymentPurposeTemplate: text("payment_purpose_template"),
    notes: text("notes"),
    isDefault: boolean("is_default").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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
      "requisites_owner_fk_chk",
      sql`(
        ${table.ownerType} = 'organization'
        and ${table.organizationId} is not null
        and ${table.counterpartyId} is null
      ) or (
        ${table.ownerType} = 'counterparty'
        and ${table.counterpartyId} is not null
        and ${table.organizationId} is null
      )`,
    ),
    index("requisites_owner_type_idx").on(table.ownerType),
    index("requisites_organization_idx").on(table.organizationId),
    index("requisites_counterparty_idx").on(table.counterpartyId),
    index("requisites_provider_idx").on(table.providerId),
    index("requisites_provider_branch_idx").on(table.providerBranchId),
    index("requisites_currency_idx").on(table.currencyId),
    index("requisites_kind_idx").on(table.kind),
    uniqueIndex("requisites_default_organization_uq")
      .on(table.organizationId, table.currencyId)
      .where(
        sql`${table.ownerType} = 'organization' and ${table.isDefault} = true and ${table.archivedAt} is null`,
      ),
    uniqueIndex("requisites_default_counterparty_uq")
      .on(table.counterpartyId, table.currencyId)
      .where(
        sql`${table.ownerType} = 'counterparty' and ${table.isDefault} = true and ${table.archivedAt} is null`,
      ),
  ],
);

export const requisiteIdentifiers = pgTable(
  "requisite_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requisiteId: uuid("requisite_id")
      .notNull()
      .references(() => requisites.id, { onDelete: "cascade" }),
    scheme: text("scheme").notNull(),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
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
    index("requisite_identifiers_requisite_idx").on(table.requisiteId),
    uniqueIndex("requisite_identifiers_value_uq").on(
      table.requisiteId,
      table.scheme,
      table.normalizedValue,
    ),
    uniqueIndex("requisite_identifiers_primary_uq")
      .on(table.requisiteId, table.scheme)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const organizationRequisiteBindings = pgTable(
  "organization_requisite_bindings",
  {
    requisiteId: uuid("requisite_id")
      .primaryKey()
      .references(() => requisites.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    bookAccountInstanceId: uuid("book_account_instance_id")
      .notNull()
      .references(() => bookAccountInstances.id),
    postingAccountNo: text("posting_account_no").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("requisite_accounting_bindings_book_idx").on(table.bookId),
    index("requisite_accounting_bindings_instance_idx").on(
      table.bookAccountInstanceId,
    ),
  ],
);

export const schema = {
  requisites,
  requisiteProviders,
  requisiteProviderIdentifiers,
  requisiteProviderBranches,
  requisiteProviderBranchIdentifiers,
  requisiteIdentifiers,
  organizationRequisiteBindings,
};

export type RequisiteRow = typeof requisites.$inferSelect;
export type RequisiteProviderRow = typeof requisiteProviders.$inferSelect;
export type RequisiteProviderIdentifierRow =
  typeof requisiteProviderIdentifiers.$inferSelect;
export type RequisiteProviderBranchRow =
  typeof requisiteProviderBranches.$inferSelect;
export type RequisiteProviderBranchIdentifierRow =
  typeof requisiteProviderBranchIdentifiers.$inferSelect;
export type RequisiteIdentifierRow = typeof requisiteIdentifiers.$inferSelect;
export type OrganizationRequisiteBindingRow =
  typeof organizationRequisiteBindings.$inferSelect;
