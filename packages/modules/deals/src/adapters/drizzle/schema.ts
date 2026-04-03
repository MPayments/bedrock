import { relations, sql } from "drizzle-orm";
import {
  bigint,
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

import { agreements, agreementVersions } from "@bedrock/agreements/schema";
import { calculations } from "@bedrock/calculations/schema";
import { currencies } from "@bedrock/currencies/schema";
import { user } from "@bedrock/iam/schema";
import {
  counterparties,
  customers,
  organizations,
} from "@bedrock/parties/schema";

import type { DealIntakeDraft } from "../../application/contracts/dto";
import {
  DEAL_ATTACHMENT_INGESTION_STATUS_VALUES,
  DEAL_APPROVAL_STATUS_VALUES,
  DEAL_APPROVAL_TYPE_VALUES,
  DEAL_CAPABILITY_KIND_VALUES,
  DEAL_CAPABILITY_STATUS_VALUES,
  DEAL_LEG_KIND_VALUES,
  DEAL_LEG_OPERATION_KIND_VALUES,
  DEAL_LEG_STATE_VALUES,
  DEAL_OPERATIONAL_POSITION_KIND_VALUES,
  DEAL_OPERATIONAL_POSITION_STATE_VALUES,
  DEAL_PARTICIPANT_ROLE_VALUES,
  DEAL_STATUS_VALUES,
  DEAL_TIMELINE_EVENT_TYPE_VALUES,
  DEAL_TIMELINE_VISIBILITY_VALUES,
  DEAL_TYPE_VALUES,
} from "../../domain/constants";

export const dealTypeEnum = pgEnum("deal_type", DEAL_TYPE_VALUES);
export const dealStatusEnum = pgEnum("deal_status", DEAL_STATUS_VALUES);
export const dealLegKindEnum = pgEnum("deal_leg_kind", DEAL_LEG_KIND_VALUES);
export const dealLegStateEnum = pgEnum("deal_leg_state", DEAL_LEG_STATE_VALUES);
export const dealLegOperationKindEnum = pgEnum(
  "deal_leg_operation_kind",
  DEAL_LEG_OPERATION_KIND_VALUES,
);
export const dealCapabilityKindEnum = pgEnum(
  "deal_capability_kind",
  DEAL_CAPABILITY_KIND_VALUES,
);
export const dealCapabilityStatusEnum = pgEnum(
  "deal_capability_status",
  DEAL_CAPABILITY_STATUS_VALUES,
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
    nextAction: text("next_action"),
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
  ],
);

export const dealIntakeSnapshots = pgTable(
  "deal_intake_snapshots",
  {
    dealId: uuid("deal_id")
      .primaryKey()
      .references(() => deals.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").$type<DealIntakeDraft>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("deal_intake_snapshots_revision_idx").on(table.revision),
    index("deal_intake_snapshots_applicant_idx").on(
      sql`((snapshot -> 'common' ->> 'applicantCounterpartyId'))`,
    ),
    index("deal_intake_snapshots_invoice_idx").on(
      sql`((snapshot -> 'incomingReceipt' ->> 'invoiceNumber'))`,
    ),
    index("deal_intake_snapshots_contract_idx").on(
      sql`((snapshot -> 'incomingReceipt' ->> 'contractNumber'))`,
    ),
    index("deal_intake_snapshots_requested_execution_idx").on(
      sql`((snapshot -> 'common' ->> 'requestedExecutionDate'))`,
    ),
    index("deal_intake_snapshots_expected_at_idx").on(
      sql`((snapshot -> 'incomingReceipt' ->> 'expectedAt'))`,
    ),
    index("deal_intake_snapshots_payer_idx").on(
      sql`((snapshot -> 'incomingReceipt' ->> 'payerCounterpartyId'))`,
    ),
    index("deal_intake_snapshots_beneficiary_idx").on(
      sql`((snapshot -> 'externalBeneficiary' ->> 'beneficiaryCounterpartyId'))`,
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

export const dealQuoteAcceptances = pgTable(
  "deal_quote_acceptances",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    acceptedByUserId: text("accepted_by_user_id")
      .notNull()
      .references(() => user.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    dealRevision: integer("deal_revision").notNull(),
    agreementVersionId: uuid("agreement_version_id").references(
      () => agreementVersions.id,
      { onDelete: "set null" },
    ),
    replacedByQuoteId: uuid("replaced_by_quote_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("deal_quote_acceptances_deal_idx").on(table.dealId, table.acceptedAt),
    index("deal_quote_acceptances_quote_idx").on(table.quoteId),
    uniqueIndex("deal_quote_acceptances_deal_quote_uq").on(
      table.dealId,
      table.quoteId,
    ),
  ],
);

export const dealCapabilityStates = pgTable(
  "deal_capability_states",
  {
    id: uuid("id").primaryKey(),
    applicantCounterpartyId: uuid("applicant_counterparty_id")
      .notNull()
      .references(() => counterparties.id, { onDelete: "cascade" }),
    internalEntityOrganizationId: uuid("internal_entity_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dealType: dealTypeEnum("deal_type").notNull(),
    capabilityKind: dealCapabilityKindEnum("capability_kind").notNull(),
    status: dealCapabilityStatusEnum("status").notNull(),
    reasonCode: text("reason_code"),
    note: text("note"),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
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
    uniqueIndex("deal_capability_states_scope_uq").on(
      table.applicantCounterpartyId,
      table.internalEntityOrganizationId,
      table.dealType,
      table.capabilityKind,
    ),
    index("deal_capability_states_applicant_idx").on(
      table.applicantCounterpartyId,
    ),
    index("deal_capability_states_internal_entity_idx").on(
      table.internalEntityOrganizationId,
    ),
    index("deal_capability_states_status_idx").on(table.status),
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
  intakeSnapshot: one(dealIntakeSnapshots, {
    fields: [deals.id],
    references: [dealIntakeSnapshots.dealId],
  }),
  legs: many(dealLegs),
  operationalPositions: many(dealOperationalPositions),
  participants: many(dealParticipants),
  quoteAcceptances: many(dealQuoteAcceptances),
  attachmentIngestions: many(dealAttachmentIngestions),
  timelineEvents: many(dealTimelineEvents),
}));

export const dealIntakeSnapshotsRelations = relations(
  dealIntakeSnapshots,
  ({ one }) => ({
    deal: one(deals, {
      fields: [dealIntakeSnapshots.dealId],
      references: [deals.id],
    }),
  }),
);

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

export const dealQuoteAcceptancesRelations = relations(
  dealQuoteAcceptances,
  ({ one }) => ({
    acceptedBy: one(user, {
      fields: [dealQuoteAcceptances.acceptedByUserId],
      references: [user.id],
    }),
    agreementVersion: one(agreementVersions, {
      fields: [dealQuoteAcceptances.agreementVersionId],
      references: [agreementVersions.id],
    }),
    deal: one(deals, {
      fields: [dealQuoteAcceptances.dealId],
      references: [deals.id],
    }),
  }),
);

export const dealCapabilityStatesRelations = relations(
  dealCapabilityStates,
  ({ one }) => ({
    applicant: one(counterparties, {
      fields: [dealCapabilityStates.applicantCounterpartyId],
      references: [counterparties.id],
    }),
    internalEntity: one(organizations, {
      fields: [dealCapabilityStates.internalEntityOrganizationId],
      references: [organizations.id],
    }),
    updatedBy: one(user, {
      fields: [dealCapabilityStates.updatedByUserId],
      references: [user.id],
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
