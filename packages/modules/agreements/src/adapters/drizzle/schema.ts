import { relations, sql } from "drizzle-orm";
import {
  bigint,
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
  AGREEMENT_ROUTE_POLICY_COMMISSION_UNIT_VALUES,
  AGREEMENT_ROUTE_POLICY_DEAL_TYPE_VALUES,
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
export const agreementRoutePolicyDealTypeEnum = pgEnum(
  "agreement_route_policy_deal_type",
  AGREEMENT_ROUTE_POLICY_DEAL_TYPE_VALUES,
);
export const agreementRoutePolicyCommissionUnitEnum = pgEnum(
  "agreement_route_policy_commission_unit",
  AGREEMENT_ROUTE_POLICY_COMMISSION_UNIT_VALUES,
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

export const agreementRoutePolicies = pgTable(
  "agreement_route_policies",
  {
    id: uuid("id").primaryKey(),
    agreementVersionId: uuid("agreement_version_id")
      .notNull()
      .references(() => agreementVersions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    dealType: agreementRoutePolicyDealTypeEnum("deal_type").notNull(),
    sourceCurrencyId: uuid("source_currency_id").references(() => currencies.id),
    targetCurrencyId: uuid("target_currency_id").references(() => currencies.id),
    defaultMarkupBps: numeric("default_markup_bps", {
      precision: 20,
      scale: 8,
    }),
    defaultWireFeeAmountMinor: bigint("default_wire_fee_amount_minor", {
      mode: "bigint",
    }),
    defaultWireFeeCurrencyId: uuid("default_wire_fee_currency_id").references(
      () => currencies.id,
    ),
    defaultSubAgentCommissionUnit: agreementRoutePolicyCommissionUnitEnum(
      "default_sub_agent_commission_unit",
    ),
    defaultSubAgentCommissionBps: numeric("default_sub_agent_commission_bps", {
      precision: 20,
      scale: 8,
    }),
    defaultSubAgentCommissionAmountMinor: bigint(
      "default_sub_agent_commission_amount_minor",
      { mode: "bigint" },
    ),
    defaultSubAgentCommissionCurrencyId: uuid(
      "default_sub_agent_commission_currency_id",
    ).references(() => currencies.id),
    approvalThresholdAmountMinor: bigint("approval_threshold_amount_minor", {
      mode: "bigint",
    }),
    approvalThresholdCurrencyId: uuid("approval_threshold_currency_id").references(
      () => currencies.id,
    ),
    quoteValiditySeconds: integer("quote_validity_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("agreement_route_policies_version_sequence_uq").on(
      table.agreementVersionId,
      table.sequence,
    ),
    index("agreement_route_policies_version_idx").on(table.agreementVersionId),
    check(
      "agreement_route_policies_wire_fee_currency_chk",
      sql`(
        ${table.defaultWireFeeAmountMinor} is null
        and ${table.defaultWireFeeCurrencyId} is null
      ) or (
        ${table.defaultWireFeeAmountMinor} is not null
        and ${table.defaultWireFeeCurrencyId} is not null
      )`,
    ),
    check(
      "agreement_route_policies_approval_threshold_currency_chk",
      sql`(
        ${table.approvalThresholdAmountMinor} is null
        and ${table.approvalThresholdCurrencyId} is null
      ) or (
        ${table.approvalThresholdAmountMinor} is not null
        and ${table.approvalThresholdCurrencyId} is not null
      )`,
    ),
    check(
      "agreement_route_policies_subagent_commission_chk",
      sql`(
        ${table.defaultSubAgentCommissionUnit} is null
        and ${table.defaultSubAgentCommissionBps} is null
        and ${table.defaultSubAgentCommissionAmountMinor} is null
        and ${table.defaultSubAgentCommissionCurrencyId} is null
      ) or (
        ${table.defaultSubAgentCommissionUnit} = 'bps'
        and ${table.defaultSubAgentCommissionBps} is not null
        and ${table.defaultSubAgentCommissionAmountMinor} is null
        and ${table.defaultSubAgentCommissionCurrencyId} is null
      ) or (
        ${table.defaultSubAgentCommissionUnit} = 'money'
        and ${table.defaultSubAgentCommissionBps} is null
        and ${table.defaultSubAgentCommissionAmountMinor} is not null
        and ${table.defaultSubAgentCommissionCurrencyId} is not null
      )`,
    ),
  ],
);

export const agreementRouteTemplateLinks = pgTable(
  "agreement_route_template_links",
  {
    id: uuid("id").primaryKey(),
    agreementRoutePolicyId: uuid("agreement_route_policy_id")
      .notNull()
      .references(() => agreementRoutePolicies.id, { onDelete: "cascade" }),
    routeTemplateId: uuid("route_template_id").notNull(),
    sequence: integer("sequence").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("agreement_route_template_links_policy_template_uq").on(
      table.agreementRoutePolicyId,
      table.routeTemplateId,
    ),
    uniqueIndex("agreement_route_template_links_policy_sequence_uq").on(
      table.agreementRoutePolicyId,
      table.sequence,
    ),
    uniqueIndex("agreement_route_template_links_default_uq")
      .on(table.agreementRoutePolicyId)
      .where(sql`${table.isDefault} = true`),
    index("agreement_route_template_links_policy_idx").on(
      table.agreementRoutePolicyId,
    ),
  ],
);

export const agreementsRelations = relations(agreements, ({ many, one }) => ({
  customer: one(customers, {
    fields: [agreements.customerId],
    references: [customers.id],
  }),
  organization: one(organizations, {
    fields: [agreements.organizationId],
    references: [organizations.id],
  }),
  organizationRequisite: one(requisites, {
    fields: [agreements.organizationRequisiteId],
    references: [requisites.id],
  }),
  currentVersion: one(agreementVersions, {
    relationName: "agreements_current_version",
    fields: [agreements.currentVersionId],
    references: [agreementVersions.id],
  }),
  versions: many(agreementVersions, {
    relationName: "agreement_versions_agreement",
  }),
}));

export const agreementVersionsRelations = relations(
  agreementVersions,
  ({ many, one }) => ({
    agreement: one(agreements, {
      relationName: "agreement_versions_agreement",
      fields: [agreementVersions.agreementId],
      references: [agreements.id],
    }),
    feeRules: many(agreementFeeRules),
    parties: many(agreementParties),
    routePolicies: many(agreementRoutePolicies),
  }),
);

export const agreementFeeRulesRelations = relations(
  agreementFeeRules,
  ({ one }) => ({
    agreementVersion: one(agreementVersions, {
      fields: [agreementFeeRules.agreementVersionId],
      references: [agreementVersions.id],
    }),
    currency: one(currencies, {
      fields: [agreementFeeRules.currencyId],
      references: [currencies.id],
    }),
  }),
);

export const agreementPartiesRelations = relations(
  agreementParties,
  ({ one }) => ({
    agreementVersion: one(agreementVersions, {
      fields: [agreementParties.agreementVersionId],
      references: [agreementVersions.id],
    }),
    customer: one(customers, {
      fields: [agreementParties.customerId],
      references: [customers.id],
    }),
    organization: one(organizations, {
      fields: [agreementParties.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const agreementRoutePoliciesRelations = relations(
  agreementRoutePolicies,
  ({ many, one }) => ({
    agreementVersion: one(agreementVersions, {
      fields: [agreementRoutePolicies.agreementVersionId],
      references: [agreementVersions.id],
    }),
    approvalThresholdCurrency: one(currencies, {
      fields: [agreementRoutePolicies.approvalThresholdCurrencyId],
      references: [currencies.id],
      relationName: "agreement_route_policy_approval_threshold_currency",
    }),
    defaultSubAgentCommissionCurrency: one(currencies, {
      fields: [agreementRoutePolicies.defaultSubAgentCommissionCurrencyId],
      references: [currencies.id],
      relationName:
        "agreement_route_policy_default_sub_agent_commission_currency",
    }),
    defaultWireFeeCurrency: one(currencies, {
      fields: [agreementRoutePolicies.defaultWireFeeCurrencyId],
      references: [currencies.id],
      relationName: "agreement_route_policy_default_wire_fee_currency",
    }),
    sourceCurrency: one(currencies, {
      fields: [agreementRoutePolicies.sourceCurrencyId],
      references: [currencies.id],
      relationName: "agreement_route_policy_source_currency",
    }),
    targetCurrency: one(currencies, {
      fields: [agreementRoutePolicies.targetCurrencyId],
      references: [currencies.id],
      relationName: "agreement_route_policy_target_currency",
    }),
    templateLinks: many(agreementRouteTemplateLinks),
  }),
);

export const agreementRouteTemplateLinksRelations = relations(
  agreementRouteTemplateLinks,
  ({ one }) => ({
    agreementRoutePolicy: one(agreementRoutePolicies, {
      fields: [agreementRouteTemplateLinks.agreementRoutePolicyId],
      references: [agreementRoutePolicies.id],
    }),
  }),
);
