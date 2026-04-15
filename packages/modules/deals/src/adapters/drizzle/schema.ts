import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { agreements } from "@bedrock/agreements/schema";
import { calculations } from "@bedrock/calculations/schema";
import { currencies } from "@bedrock/currencies/schema";
import { user } from "@bedrock/iam/schema";
import {
  counterparties,
  customers,
  organizations,
  requisites,
} from "@bedrock/parties/schema";

import type { DealHeader } from "../../application/contracts/dto";
import {
  DEAL_ATTACHMENT_INGESTION_STATUS_VALUES,
  DEAL_APPROVAL_STATUS_VALUES,
  DEAL_APPROVAL_TYPE_VALUES,
  DEAL_LEG_KIND_VALUES,
  DEAL_LEG_OPERATION_KIND_VALUES,
  DEAL_LEG_STATE_VALUES,
  DEAL_OPERATIONAL_POSITION_KIND_VALUES,
  DEAL_OPERATIONAL_POSITION_STATE_VALUES,
  DEAL_PARTICIPANT_ROLE_VALUES,
  DEAL_ROUTE_COMPONENT_BASIS_TYPE_VALUES,
  DEAL_ROUTE_COMPONENT_CLASSIFICATION_VALUES,
  DEAL_ROUTE_COMPONENT_FORMULA_TYPE_VALUES,
  DEAL_ROUTE_LEG_KIND_VALUES,
  DEAL_ROUTE_PARTY_KIND_VALUES,
  DEAL_ROUTE_TEMPLATE_PARTICIPANT_BINDING_VALUES,
  DEAL_ROUTE_TEMPLATE_STATUS_VALUES,
  DEAL_STATUS_VALUES,
  DEAL_TIMELINE_EVENT_TYPE_VALUES,
  DEAL_TIMELINE_VISIBILITY_VALUES,
  DEAL_TYPE_VALUES,
} from "../../domain/constants";

export const dealTypeEnum = pgEnum("deal_type", DEAL_TYPE_VALUES);
export const dealStatusEnum = pgEnum("deal_status", DEAL_STATUS_VALUES);
export const dealRoutePartyKindEnum = pgEnum(
  "deal_route_party_kind",
  DEAL_ROUTE_PARTY_KIND_VALUES,
);
export const dealRouteTemplateStatusEnum = pgEnum(
  "deal_route_template_status",
  DEAL_ROUTE_TEMPLATE_STATUS_VALUES,
);
export const dealRouteTemplateParticipantBindingEnum = pgEnum(
  "deal_route_template_participant_binding",
  DEAL_ROUTE_TEMPLATE_PARTICIPANT_BINDING_VALUES,
);
export const dealRouteLegKindEnum = pgEnum(
  "deal_route_leg_kind",
  DEAL_ROUTE_LEG_KIND_VALUES,
);
export const dealRouteComponentClassificationEnum = pgEnum(
  "deal_route_component_classification",
  DEAL_ROUTE_COMPONENT_CLASSIFICATION_VALUES,
);
export const dealRouteComponentFormulaTypeEnum = pgEnum(
  "deal_route_component_formula_type",
  DEAL_ROUTE_COMPONENT_FORMULA_TYPE_VALUES,
);
export const dealRouteComponentBasisTypeEnum = pgEnum(
  "deal_route_component_basis_type",
  DEAL_ROUTE_COMPONENT_BASIS_TYPE_VALUES,
);
export const dealLegKindEnum = pgEnum("deal_leg_kind", DEAL_LEG_KIND_VALUES);
export const dealLegStateEnum = pgEnum("deal_leg_state", DEAL_LEG_STATE_VALUES);
export const dealLegOperationKindEnum = pgEnum(
  "deal_leg_operation_kind",
  DEAL_LEG_OPERATION_KIND_VALUES,
);
export const dealOperationalPositionKindEnum = pgEnum(
  "deal_operational_position_kind",
  DEAL_OPERATIONAL_POSITION_KIND_VALUES,
);
export const dealOperationalPositionStateEnum = pgEnum(
  "deal_operational_position_state",
  DEAL_OPERATIONAL_POSITION_STATE_VALUES,
);
export const dealAttachmentIngestionStatusEnum = pgEnum(
  "deal_attachment_ingestion_status",
  DEAL_ATTACHMENT_INGESTION_STATUS_VALUES,
);
export const dealParticipantRoleEnum = pgEnum(
  "deal_participant_role",
  DEAL_PARTICIPANT_ROLE_VALUES,
);
export const dealTimelineEventTypeEnum = pgEnum(
  "deal_timeline_event_type",
  DEAL_TIMELINE_EVENT_TYPE_VALUES,
);
export const dealTimelineVisibilityEnum = pgEnum(
  "deal_timeline_visibility",
  DEAL_TIMELINE_VISIBILITY_VALUES,
);
export const dealApprovalTypeEnum = pgEnum(
  "deal_approval_type",
  DEAL_APPROVAL_TYPE_VALUES,
);
export const dealApprovalStatusEnum = pgEnum(
  "deal_approval_status",
  DEAL_APPROVAL_STATUS_VALUES,
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => agreements.id),
    calculationId: uuid("calculation_id").references(() => calculations.id),
    type: dealTypeEnum("type").notNull(),
    status: dealStatusEnum("status").notNull().default("draft"),
    agentId: text("agent_id").references(() => user.id),
    comment: text("comment"),
    nextAction: text("next_action"),
    headerRevision: integer("header_revision").notNull().default(1),
    headerSnapshot: jsonb("header_snapshot").$type<DealHeader>().notNull(),
    sourceAmountMinor: bigint("source_amount_minor", { mode: "bigint" }),
    sourceCurrencyId: uuid("source_currency_id").references(() => currencies.id),
    targetCurrencyId: uuid("target_currency_id").references(() => currencies.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("deals_customer_idx").on(table.customerId),
    index("deals_agreement_idx").on(table.agreementId),
    index("deals_calculation_idx").on(table.calculationId),
    index("deals_agent_idx").on(table.agentId),
    index("deals_status_idx").on(table.status),
    index("deals_type_idx").on(table.type),
    index("deals_source_currency_idx").on(table.sourceCurrencyId),
    index("deals_target_currency_idx").on(table.targetCurrencyId),
    index("deals_header_revision_idx").on(table.headerRevision),
    index("deals_header_applicant_idx").on(
      sql`((header_snapshot -> 'common' ->> 'applicantCounterpartyId'))`,
    ),
    index("deals_header_invoice_idx").on(
      sql`((header_snapshot -> 'incomingReceipt' ->> 'invoiceNumber'))`,
    ),
    index("deals_header_contract_idx").on(
      sql`((header_snapshot -> 'incomingReceipt' ->> 'contractNumber'))`,
    ),
    index("deals_header_requested_execution_idx").on(
      sql`((header_snapshot -> 'common' ->> 'requestedExecutionDate'))`,
    ),
    index("deals_header_expected_at_idx").on(
      sql`((header_snapshot -> 'incomingReceipt' ->> 'expectedAt'))`,
    ),
    index("deals_header_payer_idx").on(
      sql`((header_snapshot -> 'incomingReceipt' ->> 'payerCounterpartyId'))`,
    ),
    index("deals_header_beneficiary_idx").on(
      sql`((header_snapshot -> 'externalBeneficiary' ->> 'beneficiaryCounterpartyId'))`,
    ),
  ],
);

export const dealCalculationLinks = pgTable(
  "deal_calculation_links",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    calculationId: uuid("calculation_id")
      .notNull()
      .references(() => calculations.id, { onDelete: "cascade" }),
    sourceQuoteId: uuid("source_quote_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("deal_calculation_links_deal_calc_uq").on(
      table.dealId,
      table.calculationId,
    ),
    index("deal_calculation_links_deal_idx").on(table.dealId),
    index("deal_calculation_links_calculation_idx").on(table.calculationId),
  ],
);

export const dealRoutes = pgTable(
  "deal_routes",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    currentVersionId: uuid("current_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("deal_routes_deal_uq").on(table.dealId),
    index("deal_routes_current_version_idx").on(table.currentVersionId),
  ],
);

export const dealRouteVersions = pgTable(
  "deal_route_versions",
  {
    id: uuid("id").primaryKey(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => dealRoutes.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    validationIssues: jsonb("validation_issues")
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("deal_route_versions_route_version_uq").on(
      table.routeId,
      table.version,
    ),
    index("deal_route_versions_deal_idx").on(table.dealId, table.createdAt),
  ],
);

export const dealRouteParticipants = pgTable(
  "deal_route_participants",
  {
    id: uuid("id").primaryKey(),
    routeVersionId: uuid("route_version_id")
      .notNull()
      .references(() => dealRouteVersions.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    role: text("role").notNull(),
    partyKind: dealRoutePartyKindEnum("party_kind").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "cascade",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    counterpartyId: uuid("counterparty_id").references(() => counterparties.id, {
      onDelete: "cascade",
    }),
    requisiteId: uuid("requisite_id").references(() => requisites.id, {
      onDelete: "set null",
    }),
    displayNameSnapshot: text("display_name_snapshot"),
    sequence: integer("sequence").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("deal_route_participants_version_code_uq").on(
      table.routeVersionId,
      table.code,
    ),
    uniqueIndex("deal_route_participants_version_sequence_uq").on(
      table.routeVersionId,
      table.sequence,
    ),
    check(
      "deal_route_participants_exactly_one_fk_chk",
      sql`(
        ${table.customerId} is not null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.customerId} is null
        and ${table.organizationId} is not null
        and ${table.counterpartyId} is null
      ) or (
        ${table.customerId} is null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is not null
      )`,
    ),
    check(
      "deal_route_participants_kind_fk_match_chk",
      sql`(
        ${table.partyKind} = 'customer'
        and ${table.customerId} is not null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.partyKind} = 'organization'
        and ${table.organizationId} is not null
        and ${table.customerId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.partyKind} = 'counterparty'
        and ${table.counterpartyId} is not null
        and ${table.customerId} is null
        and ${table.organizationId} is null
      )`,
    ),
  ],
);

export const dealRouteLegs = pgTable(
  "deal_route_legs",
  {
    id: uuid("id").primaryKey(),
    routeVersionId: uuid("route_version_id")
      .notNull()
      .references(() => dealRouteVersions.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    idx: integer("idx").notNull(),
    kind: dealRouteLegKindEnum("kind").notNull(),
    fromParticipantId: uuid("from_participant_id")
      .notNull()
      .references(() => dealRouteParticipants.id, { onDelete: "cascade" }),
    toParticipantId: uuid("to_participant_id")
      .notNull()
      .references(() => dealRouteParticipants.id, { onDelete: "cascade" }),
    fromCurrencyId: uuid("from_currency_id")
      .notNull()
      .references(() => currencies.id),
    toCurrencyId: uuid("to_currency_id")
      .notNull()
      .references(() => currencies.id),
    expectedFromAmountMinor: bigint("expected_from_amount_minor", {
      mode: "bigint",
    }),
    expectedToAmountMinor: bigint("expected_to_amount_minor", {
      mode: "bigint",
    }),
    expectedRateNum: bigint("expected_rate_num", { mode: "bigint" }),
    expectedRateDen: bigint("expected_rate_den", { mode: "bigint" }),
    settlementModel: text("settlement_model").notNull(),
    executionCounterpartyId: uuid("execution_counterparty_id").references(
      () => counterparties.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("deal_route_legs_version_code_uq").on(
      table.routeVersionId,
      table.code,
    ),
    uniqueIndex("deal_route_legs_version_idx_uq").on(
      table.routeVersionId,
      table.idx,
    ),
  ],
);

export const dealRouteCostComponents = pgTable(
  "deal_route_cost_components",
  {
    id: uuid("id").primaryKey(),
    routeVersionId: uuid("route_version_id")
      .notNull()
      .references(() => dealRouteVersions.id, { onDelete: "cascade" }),
    legId: uuid("leg_id").references(() => dealRouteLegs.id, {
      onDelete: "set null",
    }),
    code: text("code").notNull(),
    family: text("family").notNull(),
    classification: dealRouteComponentClassificationEnum(
      "classification",
    ).notNull(),
    formulaType: dealRouteComponentFormulaTypeEnum("formula_type").notNull(),
    basisType: dealRouteComponentBasisTypeEnum("basis_type").notNull(),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    fixedAmountMinor: bigint("fixed_amount_minor", { mode: "bigint" }),
    bps: text("bps"),
    perMillion: text("per_million"),
    manualAmountMinor: bigint("manual_amount_minor", { mode: "bigint" }),
    roundingMode: text("rounding_mode").notNull(),
    includedInClientRate: boolean("included_in_client_rate")
      .notNull()
      .default(false),
    sequence: integer("sequence").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("deal_route_cost_components_version_code_uq").on(
      table.routeVersionId,
      table.code,
    ),
    uniqueIndex("deal_route_cost_components_version_sequence_uq").on(
      table.routeVersionId,
      table.sequence,
    ),
  ],
);

export const routeTemplates = pgTable(
  "route_templates",
  {
    id: uuid("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    dealType: dealTypeEnum("deal_type").notNull(),
    description: text("description"),
    status: dealRouteTemplateStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("route_templates_code_uq").on(table.code),
    index("route_templates_status_idx").on(table.status, table.updatedAt),
    index("route_templates_deal_type_idx").on(table.dealType),
  ],
);

export const routeTemplateParticipants = pgTable(
  "route_template_participants",
  {
    id: uuid("id").primaryKey(),
    routeTemplateId: uuid("route_template_id")
      .notNull()
      .references(() => routeTemplates.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    role: text("role").notNull(),
    bindingKind: dealRouteTemplateParticipantBindingEnum("binding_kind").notNull(),
    partyKind: dealRoutePartyKindEnum("party_kind").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "cascade",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    counterpartyId: uuid("counterparty_id").references(() => counterparties.id, {
      onDelete: "cascade",
    }),
    requisiteId: uuid("requisite_id").references(() => requisites.id, {
      onDelete: "set null",
    }),
    displayNameTemplate: text("display_name_template"),
    sequence: integer("sequence").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("route_template_participants_template_code_uq").on(
      table.routeTemplateId,
      table.code,
    ),
    uniqueIndex("route_template_participants_template_sequence_uq").on(
      table.routeTemplateId,
      table.sequence,
    ),
    check(
      "route_template_participants_fixed_party_fk_chk",
      sql`(
        ${table.bindingKind} <> 'fixed_party'
        and ${table.customerId} is null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.bindingKind} = 'fixed_party'
        and (
          (${table.customerId} is not null and ${table.organizationId} is null and ${table.counterpartyId} is null)
          or (${table.customerId} is null and ${table.organizationId} is not null and ${table.counterpartyId} is null)
          or (${table.customerId} is null and ${table.organizationId} is null and ${table.counterpartyId} is not null)
        )
      )`,
    ),
    check(
      "route_template_participants_fixed_party_kind_fk_match_chk",
      sql`(
        ${table.bindingKind} <> 'fixed_party'
      ) or (
        ${table.partyKind} = 'customer'
        and ${table.customerId} is not null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.partyKind} = 'organization'
        and ${table.organizationId} is not null
        and ${table.customerId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.partyKind} = 'counterparty'
        and ${table.counterpartyId} is not null
        and ${table.customerId} is null
        and ${table.organizationId} is null
      )`,
    ),
    check(
      "route_template_participants_binding_kind_party_kind_chk",
      sql`(
        ${table.bindingKind} = 'fixed_party'
      ) or (
        ${table.bindingKind} = 'deal_customer'
        and ${table.partyKind} = 'customer'
      ) or (
        ${table.bindingKind} in ('deal_applicant', 'deal_payer', 'deal_beneficiary')
        and ${table.partyKind} = 'counterparty'
      )`,
    ),
  ],
);

export const routeTemplateLegs = pgTable(
  "route_template_legs",
  {
    id: uuid("id").primaryKey(),
    routeTemplateId: uuid("route_template_id")
      .notNull()
      .references(() => routeTemplates.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    idx: integer("idx").notNull(),
    kind: dealRouteLegKindEnum("kind").notNull(),
    fromParticipantId: uuid("from_participant_id")
      .notNull()
      .references(() => routeTemplateParticipants.id, { onDelete: "cascade" }),
    toParticipantId: uuid("to_participant_id")
      .notNull()
      .references(() => routeTemplateParticipants.id, { onDelete: "cascade" }),
    fromCurrencyId: uuid("from_currency_id")
      .notNull()
      .references(() => currencies.id),
    toCurrencyId: uuid("to_currency_id")
      .notNull()
      .references(() => currencies.id),
    expectedFromAmountMinor: bigint("expected_from_amount_minor", {
      mode: "bigint",
    }),
    expectedToAmountMinor: bigint("expected_to_amount_minor", {
      mode: "bigint",
    }),
    expectedRateNum: bigint("expected_rate_num", { mode: "bigint" }),
    expectedRateDen: bigint("expected_rate_den", { mode: "bigint" }),
    settlementModel: text("settlement_model").notNull(),
    executionCounterpartyId: uuid("execution_counterparty_id").references(
      () => counterparties.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("route_template_legs_template_code_uq").on(
      table.routeTemplateId,
      table.code,
    ),
    uniqueIndex("route_template_legs_template_idx_uq").on(
      table.routeTemplateId,
      table.idx,
    ),
  ],
);

export const routeTemplateCostComponents = pgTable(
  "route_template_cost_components",
  {
    id: uuid("id").primaryKey(),
    routeTemplateId: uuid("route_template_id")
      .notNull()
      .references(() => routeTemplates.id, { onDelete: "cascade" }),
    legId: uuid("leg_id").references(() => routeTemplateLegs.id, {
      onDelete: "set null",
    }),
    code: text("code").notNull(),
    family: text("family").notNull(),
    classification: dealRouteComponentClassificationEnum(
      "classification",
    ).notNull(),
    formulaType: dealRouteComponentFormulaTypeEnum("formula_type").notNull(),
    basisType: dealRouteComponentBasisTypeEnum("basis_type").notNull(),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    fixedAmountMinor: bigint("fixed_amount_minor", { mode: "bigint" }),
    bps: text("bps"),
    perMillion: text("per_million"),
    manualAmountMinor: bigint("manual_amount_minor", { mode: "bigint" }),
    roundingMode: text("rounding_mode").notNull(),
    includedInClientRate: boolean("included_in_client_rate")
      .notNull()
      .default(false),
    sequence: integer("sequence").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("route_template_cost_components_template_code_uq").on(
      table.routeTemplateId,
      table.code,
    ),
    uniqueIndex("route_template_cost_components_template_sequence_uq").on(
      table.routeTemplateId,
      table.sequence,
    ),
  ],
);

export const dealLegs = pgTable(
  "deal_legs",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    kind: dealLegKindEnum("kind").notNull(),
    state: dealLegStateEnum("state").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("deal_legs_deal_idx_uq").on(table.dealId, table.idx),
    index("deal_legs_deal_idx").on(table.dealId),
  ],
);

export const dealLegOperationLinks = pgTable(
  "deal_leg_operation_links",
  {
    id: uuid("id").primaryKey(),
    dealLegId: uuid("deal_leg_id")
      .notNull()
      .references(() => dealLegs.id, { onDelete: "cascade" }),
    treasuryOperationId: uuid("treasury_operation_id").notNull(),
    operationKind: dealLegOperationKindEnum("operation_kind").notNull(),
    sourceRef: text("source_ref").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("deal_leg_operation_links_source_ref_uq").on(table.sourceRef),
    uniqueIndex("deal_leg_operation_links_leg_operation_uq").on(
      table.dealLegId,
      table.treasuryOperationId,
    ),
    index("deal_leg_operation_links_leg_idx").on(table.dealLegId),
    index("deal_leg_operation_links_operation_idx").on(table.treasuryOperationId),
  ],
);

export const dealParticipants = pgTable(
  "deal_participants",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    role: dealParticipantRoleEnum("role").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "cascade",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    counterpartyId: uuid("counterparty_id").references(() => counterparties.id, {
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
    uniqueIndex("deal_participants_deal_role_uq").on(table.dealId, table.role),
    index("deal_participants_deal_idx").on(table.dealId),
    check(
      "deal_participants_exactly_one_fk_chk",
      sql`(
        ${table.customerId} is not null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.customerId} is null
        and ${table.organizationId} is not null
        and ${table.counterpartyId} is null
      ) or (
        ${table.customerId} is null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is not null
      )`,
    ),
    check(
      "deal_participants_role_fk_match_chk",
      sql`(
        ${table.role} = 'customer'
        and ${table.customerId} is not null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.role} = 'internal_entity'
        and ${table.organizationId} is not null
        and ${table.customerId} is null
        and ${table.counterpartyId} is null
      ) or (
        ${table.role} in ('applicant', 'external_payer', 'external_beneficiary')
        and ${table.counterpartyId} is not null
        and ${table.customerId} is null
        and ${table.organizationId} is null
      )`,
    ),
  ],
);

export const dealTimelineEvents = pgTable(
  "deal_timeline_events",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    type: dealTimelineEventTypeEnum("type").notNull(),
    visibility: dealTimelineVisibilityEnum("visibility")
      .notNull()
      .default("internal"),
    actorUserId: text("actor_user_id").references(() => user.id),
    actorLabel: text("actor_label"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    sourceRef: text("source_ref"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("deal_timeline_events_deal_occurred_idx").on(
      table.dealId,
      table.occurredAt,
    ),
    uniqueIndex("deal_timeline_events_deal_source_ref_uq").on(
      table.dealId,
      table.sourceRef,
    ),
  ],
);


export const dealOperationalPositions = pgTable(
  "deal_operational_positions",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    kind: dealOperationalPositionKindEnum("kind").notNull(),
    state: dealOperationalPositionStateEnum("state").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyId: uuid("currency_id").references(() => currencies.id, {
      onDelete: "set null",
    }),
    reasonCode: text("reason_code"),
    sourceRefs: jsonb("source_refs").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("deal_operational_positions_deal_kind_uq").on(
      table.dealId,
      table.kind,
    ),
    index("deal_operational_positions_deal_idx").on(table.dealId),
    index("deal_operational_positions_state_idx").on(table.state),
  ],
);

export const dealApprovals = pgTable(
  "deal_approvals",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    approvalType: dealApprovalTypeEnum("approval_type").notNull(),
    status: dealApprovalStatusEnum("status").notNull(),
    requestedBy: text("requested_by"),
    decidedBy: text("decided_by"),
    comment: text("comment"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    index("deal_approvals_deal_requested_idx").on(table.dealId, table.requestedAt),
  ],
);

export const dealAttachmentIngestions = pgTable(
  "deal_attachment_ingestions",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    fileAssetId: uuid("file_asset_id").notNull(),
    status: dealAttachmentIngestionStatusEnum("status")
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    observedRevision: integer("observed_revision").notNull(),
    appliedRevision: integer("applied_revision"),
    normalizedPayload: jsonb("normalized_payload")
      .$type<Record<string, unknown> | null>()
      .default(sql`null`),
    appliedFields: jsonb("applied_fields")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    skippedFields: jsonb("skipped_fields")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    lastProcessedAt: timestamp("last_processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("deal_attachment_ingestions_file_asset_uq").on(
      table.fileAssetId,
    ),
    index("deal_attachment_ingestions_deal_idx").on(table.dealId),
    index("deal_attachment_ingestions_status_idx").on(
      table.status,
      table.availableAt,
    ),
  ],
);

export const dealAgentBonuses = pgTable(
  "deal_agent_bonuses",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => user.id),
    commission: text("commission").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("deal_agent_bonuses_deal_agent_uq").on(
      table.dealId,
      table.agentId,
    ),
    index("deal_agent_bonuses_deal_idx").on(table.dealId),
    index("deal_agent_bonuses_agent_idx").on(table.agentId),
  ],
);

export const dealsRelations = relations(deals, ({ many, one }) => ({
  agreement: one(agreements, {
    fields: [deals.agreementId],
    references: [agreements.id],
  }),
  calculation: one(calculations, {
    fields: [deals.calculationId],
    references: [calculations.id],
  }),
  customer: one(customers, {
    fields: [deals.customerId],
    references: [customers.id],
  }),
  sourceCurrency: one(currencies, {
    fields: [deals.sourceCurrencyId],
    references: [currencies.id],
  }),
  targetCurrency: one(currencies, {
    fields: [deals.targetCurrencyId],
    references: [currencies.id],
  }),
  approvals: many(dealApprovals),
  agentBonuses: many(dealAgentBonuses),
  calculationLinks: many(dealCalculationLinks),
  route: one(dealRoutes, {
    fields: [deals.id],
    references: [dealRoutes.dealId],
  }),
  legs: many(dealLegs),
  operationalPositions: many(dealOperationalPositions),
  participants: many(dealParticipants),
  attachmentIngestions: many(dealAttachmentIngestions),
  timelineEvents: many(dealTimelineEvents),
}));

export const dealCalculationLinksRelations = relations(
  dealCalculationLinks,
  ({ one }) => ({
    calculation: one(calculations, {
      fields: [dealCalculationLinks.calculationId],
      references: [calculations.id],
    }),
    deal: one(deals, {
      fields: [dealCalculationLinks.dealId],
      references: [deals.id],
    }),
  }),
);

export const dealRoutesRelations = relations(dealRoutes, ({ many, one }) => ({
  currentVersion: one(dealRouteVersions, {
    fields: [dealRoutes.currentVersionId],
    references: [dealRouteVersions.id],
  }),
  deal: one(deals, {
    fields: [dealRoutes.dealId],
    references: [deals.id],
  }),
  versions: many(dealRouteVersions),
}));

export const dealRouteVersionsRelations = relations(
  dealRouteVersions,
  ({ many, one }) => ({
    costComponents: many(dealRouteCostComponents),
    deal: one(deals, {
      fields: [dealRouteVersions.dealId],
      references: [deals.id],
    }),
    legs: many(dealRouteLegs),
    participants: many(dealRouteParticipants),
    route: one(dealRoutes, {
      fields: [dealRouteVersions.routeId],
      references: [dealRoutes.id],
    }),
  }),
);

export const dealRouteParticipantsRelations = relations(
  dealRouteParticipants,
  ({ one }) => ({
    routeVersion: one(dealRouteVersions, {
      fields: [dealRouteParticipants.routeVersionId],
      references: [dealRouteVersions.id],
    }),
  }),
);

export const dealRouteLegsRelations = relations(dealRouteLegs, ({ one }) => ({
  fromParticipant: one(dealRouteParticipants, {
    fields: [dealRouteLegs.fromParticipantId],
    references: [dealRouteParticipants.id],
  }),
  routeVersion: one(dealRouteVersions, {
    fields: [dealRouteLegs.routeVersionId],
    references: [dealRouteVersions.id],
  }),
  toParticipant: one(dealRouteParticipants, {
    fields: [dealRouteLegs.toParticipantId],
    references: [dealRouteParticipants.id],
  }),
}));

export const dealRouteCostComponentsRelations = relations(
  dealRouteCostComponents,
  ({ one }) => ({
    leg: one(dealRouteLegs, {
      fields: [dealRouteCostComponents.legId],
      references: [dealRouteLegs.id],
    }),
    routeVersion: one(dealRouteVersions, {
      fields: [dealRouteCostComponents.routeVersionId],
      references: [dealRouteVersions.id],
    }),
  }),
);

export const routeTemplatesRelations = relations(
  routeTemplates,
  ({ many }) => ({
    costComponents: many(routeTemplateCostComponents),
    legs: many(routeTemplateLegs),
    participants: many(routeTemplateParticipants),
  }),
);

export const routeTemplateParticipantsRelations = relations(
  routeTemplateParticipants,
  ({ one }) => ({
    routeTemplate: one(routeTemplates, {
      fields: [routeTemplateParticipants.routeTemplateId],
      references: [routeTemplates.id],
    }),
  }),
);

export const routeTemplateLegsRelations = relations(
  routeTemplateLegs,
  ({ one }) => ({
    fromParticipant: one(routeTemplateParticipants, {
      fields: [routeTemplateLegs.fromParticipantId],
      references: [routeTemplateParticipants.id],
    }),
    routeTemplate: one(routeTemplates, {
      fields: [routeTemplateLegs.routeTemplateId],
      references: [routeTemplates.id],
    }),
    toParticipant: one(routeTemplateParticipants, {
      fields: [routeTemplateLegs.toParticipantId],
      references: [routeTemplateParticipants.id],
    }),
  }),
);

export const routeTemplateCostComponentsRelations = relations(
  routeTemplateCostComponents,
  ({ one }) => ({
    leg: one(routeTemplateLegs, {
      fields: [routeTemplateCostComponents.legId],
      references: [routeTemplateLegs.id],
    }),
    routeTemplate: one(routeTemplates, {
      fields: [routeTemplateCostComponents.routeTemplateId],
      references: [routeTemplates.id],
    }),
  }),
);

export const dealLegsRelations = relations(dealLegs, ({ one }) => ({
  deal: one(deals, {
    fields: [dealLegs.dealId],
    references: [deals.id],
  }),
}));

export const dealParticipantsRelations = relations(
  dealParticipants,
  ({ one }) => ({
    counterparty: one(counterparties, {
      fields: [dealParticipants.counterpartyId],
      references: [counterparties.id],
    }),
    customer: one(customers, {
      fields: [dealParticipants.customerId],
      references: [customers.id],
    }),
    deal: one(deals, {
      fields: [dealParticipants.dealId],
      references: [deals.id],
    }),
    organization: one(organizations, {
      fields: [dealParticipants.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const dealTimelineEventsRelations = relations(
  dealTimelineEvents,
  ({ one }) => ({
    actor: one(user, {
      fields: [dealTimelineEvents.actorUserId],
      references: [user.id],
    }),
    deal: one(deals, {
      fields: [dealTimelineEvents.dealId],
      references: [deals.id],
    }),
  }),
);

export const dealOperationalPositionsRelations = relations(
  dealOperationalPositions,
  ({ one }) => ({
    currency: one(currencies, {
      fields: [dealOperationalPositions.currencyId],
      references: [currencies.id],
    }),
    deal: one(deals, {
      fields: [dealOperationalPositions.dealId],
      references: [deals.id],
    }),
  }),
);

export const dealAttachmentIngestionsRelations = relations(
  dealAttachmentIngestions,
  ({ one }) => ({
    deal: one(deals, {
      fields: [dealAttachmentIngestions.dealId],
      references: [deals.id],
    }),
  }),
);

export const dealApprovalsRelations = relations(dealApprovals, ({ one }) => ({
  deal: one(deals, {
    fields: [dealApprovals.dealId],
    references: [deals.id],
  }),
}));

export const dealAgentBonusesRelations = relations(
  dealAgentBonuses,
  ({ one }) => ({
    agent: one(user, {
      fields: [dealAgentBonuses.agentId],
      references: [user.id],
    }),
    deal: one(deals, {
      fields: [dealAgentBonuses.dealId],
      references: [deals.id],
    }),
  }),
);
