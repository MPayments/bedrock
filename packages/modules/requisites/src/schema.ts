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

import { requisiteKindEnum } from "./shared";
import { currencies } from "@bedrock/currencies/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { counterparties } from "@bedrock/parties/schema";
import { organizations } from "@bedrock/organizations/schema";

import { requisiteProviders } from "./providers/schema";

export const requisiteOwnerTypeEnum = pgEnum("requisite_owner_type", [
  "organization",
  "counterparty",
]);

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
    institutionName: text("institution_name"),
    institutionCountry: text("institution_country"),
    accountNo: text("account_no"),
    corrAccount: text("corr_account"),
    iban: text("iban"),
    bic: text("bic"),
    swift: text("swift"),
    bankAddress: text("bank_address"),
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
  (t) => [
    check(
      "requisites_owner_fk_chk",
      sql`(
        ${t.ownerType} = 'organization'
        and ${t.organizationId} is not null
        and ${t.counterpartyId} is null
      ) or (
        ${t.ownerType} = 'counterparty'
        and ${t.counterpartyId} is not null
        and ${t.organizationId} is null
      )`,
    ),
    index("requisites_owner_type_idx").on(t.ownerType),
    index("requisites_organization_idx").on(t.organizationId),
    index("requisites_counterparty_idx").on(t.counterpartyId),
    index("requisites_provider_idx").on(t.providerId),
    index("requisites_currency_idx").on(t.currencyId),
    index("requisites_kind_idx").on(t.kind),
    uniqueIndex("requisites_default_organization_uq")
      .on(t.organizationId, t.currencyId)
      .where(
        sql`${t.ownerType} = 'organization' and ${t.isDefault} = true and ${t.archivedAt} is null`,
      ),
    uniqueIndex("requisites_default_counterparty_uq")
      .on(t.counterpartyId, t.currencyId)
      .where(
        sql`${t.ownerType} = 'counterparty' and ${t.isDefault} = true and ${t.archivedAt} is null`,
      ),
  ],
);

const { bookAccountInstances, books } = ledgerSchema;

export const requisiteAccountingBindings = pgTable(
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
  bookAccountInstances,
  books,
  counterparties,
  currencies,
  organizations,
  requisiteProviders,
  requisiteAccountingBindings,
  requisites,
};

export type RequisiteRow = typeof requisites.$inferSelect;
export type RequisiteInsert = typeof requisites.$inferInsert;
export type RequisiteAccountingBindingRow =
  typeof requisiteAccountingBindings.$inferSelect;
export type RequisiteAccountingBindingInsert =
  typeof requisiteAccountingBindings.$inferInsert;
