import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { currencies } from "@bedrock/currencies/schema";
import { customers, organizations, requisites } from "@bedrock/parties/schema";

import {
  AGREEMENT_FEE_RULE_KIND_VALUES,
  AGREEMENT_FEE_RULE_UNIT_VALUES,
  AGREEMENT_PARTY_ROLE_VALUES,
} from "../../domain/constants";

export const agreementFeeRuleKindEnum = pgEnum(
  "agreement_fee_rule_kind",
  AGREEMENT_FEE_RULE_KIND_VALUES,
);
export const agreementFeeRuleUnitEnum = pgEnum(
  "agreement_fee_rule_unit",
  AGREEMENT_FEE_RULE_UNIT_VALUES,
);
export const agreementPartyRoleEnum = pgEnum(
  "agreement_party_role",
  AGREEMENT_PARTY_ROLE_VALUES,
);

export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    organizationRequisiteId: uuid("organization_requisite_id")
      .notNull()
      .references(() => requisites.id),
    isActive: boolean("is_active").notNull().default(true),
    currentVersionId: uuid("current_version_id").references(
      (): AnyPgColumn => agreementVersions.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("agreements_customer_idx").on(table.customerId),
    index("agreements_organization_idx").on(table.organizationId),
    index("agreements_current_version_idx").on(table.currentVersionId),
    uniqueIndex("agreements_active_customer_uq")
      .on(table.customerId)
      .where(sql`${table.isActive} = true`),
  ],
);

export const agreementVersions = pgTable(
  "agreement_versions",
  {
    id: uuid("id").primaryKey(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => agreements.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    contractNumber: text("contract_number"),
    contractDate: date("contract_date", { mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("agreement_versions_agreement_version_uq").on(
      table.agreementId,
      table.versionNumber,
    ),
    index("agreement_versions_agreement_idx").on(table.agreementId),
  ],
);

export const agreementFeeRules = pgTable(
  "agreement_fee_rules",
  {
    id: uuid("id").primaryKey(),
    agreementVersionId: uuid("agreement_version_id")
      .notNull()
      .references(() => agreementVersions.id, { onDelete: "cascade" }),
    kind: agreementFeeRuleKindEnum("kind").notNull(),
    unit: agreementFeeRuleUnitEnum("unit").notNull(),
    valueNumeric: numeric("value_numeric", { precision: 20, scale: 8 }).notNull(),
    currencyId: uuid("currency_id").references(() => currencies.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("agreement_fee_rules_version_kind_uq").on(
      table.agreementVersionId,
      table.kind,
    ),
    index("agreement_fee_rules_version_idx").on(table.agreementVersionId),
    check(
      "agreement_fee_rules_unit_currency_chk",
      sql`(
        ${table.unit} = 'bps'
        and ${table.currencyId} is null
      ) or (
        ${table.unit} = 'money'
        and ${table.currencyId} is not null
      )`,
    ),
  ],
);

export const agreementParties = pgTable(
  "agreement_parties",
  {
    id: uuid("id").primaryKey(),
    agreementVersionId: uuid("agreement_version_id")
      .notNull()
      .references(() => agreementVersions.id, { onDelete: "cascade" }),
    partyRole: agreementPartyRoleEnum("party_role").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "cascade",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("agreement_parties_version_role_uq").on(
      table.agreementVersionId,
      table.partyRole,
    ),
    index("agreement_parties_version_idx").on(table.agreementVersionId),
    check(
      "agreement_parties_exactly_one_fk_chk",
      sql`(
        ${table.customerId} is not null
        and ${table.organizationId} is null
      ) or (
        ${table.customerId} is null
        and ${table.organizationId} is not null
      )`,
    ),
    check(
      "agreement_parties_role_fk_match_chk",
      sql`(
        ${table.partyRole} = 'customer'
        and ${table.customerId} is not null
        and ${table.organizationId} is null
      ) or (
        ${table.partyRole} = 'organization'
        and ${table.organizationId} is not null
        and ${table.customerId} is null
      )`,
    ),
  ],
);
