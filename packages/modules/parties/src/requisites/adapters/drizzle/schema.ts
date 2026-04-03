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
    name: text("name").notNull(),
    description: text("description"),
    country: text("country"),
    address: text("address"),
    contact: text("contact"),
    bic: text("bic"),
    swift: text("swift"),
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
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    kind: requisiteKindEnum("kind").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    beneficiaryName: text("beneficiary_name"),
    accountNo: text("account_no"),
    corrAccount: text("corr_account"),
    iban: text("iban"),
    network: text("network"),
    assetCode: text("asset_code"),
    address: text("address"),
    memoTag: text("memo_tag"),
    accountRef: text("account_ref"),
    subaccountRef: text("subaccount_ref"),
    contact: text("contact"),
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

export const organizationRequisiteBindings = pgTable(
  "organization_requisite_bindings",
  {
    requisiteId: uuid("requisite_id").primaryKey(),
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
  organizationRequisiteBindings,
};

export type RequisiteRow = typeof requisites.$inferSelect;
export type RequisiteProviderRow = typeof requisiteProviders.$inferSelect;
export type OrganizationRequisiteBindingRow =
  typeof organizationRequisiteBindings.$inferSelect;
