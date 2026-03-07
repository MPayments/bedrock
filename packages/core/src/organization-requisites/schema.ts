import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { counterparties } from "../counterparties/schema";
import { currencies } from "../currencies/schema";
import { schema as ledgerSchema } from "../ledger/schema";
import { requisiteKindEnum } from "../requisites/shared";

const { books, bookAccountInstances } = ledgerSchema;

export const organizationRequisites = pgTable(
  "organization_requisites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => counterparties.id, { onDelete: "cascade" }),
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
    index("organization_requisites_owner_idx").on(t.organizationId),
    index("organization_requisites_currency_idx").on(t.currencyId),
    index("organization_requisites_kind_idx").on(t.kind),
    uniqueIndex("organization_requisites_default_owner_uq")
      .on(t.organizationId, t.currencyId)
      .where(sql`${t.isDefault} = true and ${t.archivedAt} is null`),
  ],
);

export const organizationRequisiteBindings = pgTable(
  "organization_requisite_bindings",
  {
    requisiteId: uuid("requisite_id")
      .primaryKey()
      .references(() => organizationRequisites.id, { onDelete: "cascade" }),
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
  (t) => [
    index("organization_requisite_bindings_book_idx").on(t.bookId),
    index("organization_requisite_bindings_book_instance_idx").on(
      t.bookAccountInstanceId,
    ),
  ],
);

export const schema = {
  bookAccountInstances,
  books,
  counterparties,
  currencies,
  organizationRequisiteBindings,
  organizationRequisites,
};

export type OrganizationRequisite = typeof organizationRequisites.$inferSelect;
export type OrganizationRequisiteInsert =
  typeof organizationRequisites.$inferInsert;
export type OrganizationRequisiteBinding =
  typeof organizationRequisiteBindings.$inferSelect;
export type OrganizationRequisiteBindingInsert =
  typeof organizationRequisiteBindings.$inferInsert;
