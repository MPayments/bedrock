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
import { requisiteKindEnum } from "../requisites/shared";

export const counterpartyRequisites = pgTable(
  "counterparty_requisites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    counterpartyId: uuid("counterparty_id")
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
    index("counterparty_requisites_owner_idx").on(t.counterpartyId),
    index("counterparty_requisites_currency_idx").on(t.currencyId),
    index("counterparty_requisites_kind_idx").on(t.kind),
    uniqueIndex("counterparty_requisites_default_owner_uq")
      .on(t.counterpartyId, t.currencyId)
      .where(sql`${t.isDefault} = true and ${t.archivedAt} is null`),
  ],
);

export const schema = {
  counterparties,
  counterpartyRequisites,
  currencies,
};

export type CounterpartyRequisite = typeof counterpartyRequisites.$inferSelect;
export type CounterpartyRequisiteInsert =
  typeof counterpartyRequisites.$inferInsert;
