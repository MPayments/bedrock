import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { currencies } from "@bedrock/currencies/schema";
import { organizations } from "@bedrock/organizations/schema";
import { counterparties } from "@bedrock/parties/schema";

import { requisiteOwnerTypeEnum, requisiteKindEnum } from "./enums";
import { requisiteProviders } from "./requisite-providers";

export const requisites = pgTable(
  "requisites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: requisiteOwnerTypeEnum("owner_type").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    counterpartyId: uuid("counterparty_id").references(
      () => counterparties.id,
      {
        onDelete: "cascade",
      },
    ),
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

export type RequisiteRow = typeof requisites.$inferSelect;
export type RequisiteInsert = typeof requisites.$inferInsert;
