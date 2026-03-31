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

import { agreements } from "@bedrock/agreements/schema";
import { calculations } from "@bedrock/calculations/schema";
import { currencies } from "@bedrock/currencies/schema";
import { user } from "@bedrock/iam/schema";
import {
  customers,
  counterparties,
  organizations,
  type LocalizedText,
} from "@bedrock/parties/schema";

import {
  DEAL_APPROVAL_STATUS_VALUES,
  DEAL_APPROVAL_TYPE_VALUES,
  DEAL_LEG_KIND_VALUES,
  DEAL_PARTICIPANT_ROLE_VALUES,
  DEAL_STATUS_VALUES,
  DEAL_TYPE_VALUES,
} from "../../domain/constants";

export const dealTypeEnum = pgEnum("deal_type", DEAL_TYPE_VALUES);
export const dealStatusEnum = pgEnum("deal_status", DEAL_STATUS_VALUES);
export const dealLegKindEnum = pgEnum("deal_leg_kind", DEAL_LEG_KIND_VALUES);
export const dealParticipantRoleEnum = pgEnum(
  "deal_participant_role",
  DEAL_PARTICIPANT_ROLE_VALUES,
);
export const dealApprovalTypeEnum = pgEnum(
  "deal_approval_type",
  DEAL_APPROVAL_TYPE_VALUES,
);
export const dealApprovalStatusEnum = pgEnum(
  "deal_approval_status",
  DEAL_APPROVAL_STATUS_VALUES,
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

export const dealExtensions = pgTable(
  "deal_extensions",
  {
    dealId: uuid("deal_id")
      .primaryKey()
      .references(() => deals.id, { onDelete: "cascade" }),
    organizationRequisiteId: uuid("organization_requisite_id"),
    invoiceNumber: text("invoice_number"),
    invoiceDate: text("invoice_date"),
    companyName: text("company_name"),
    companyNameI18n: jsonb("company_name_i18n").$type<LocalizedText>(),
    bankName: text("bank_name"),
    bankNameI18n: jsonb("bank_name_i18n").$type<LocalizedText>(),
    account: text("account"),
    swiftCode: text("swift_code"),
    contractDate: text("contract_date"),
    contractNumber: text("contract_number"),
    costPrice: text("cost_price"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("deal_extensions_org_req_idx").on(table.organizationRequisiteId),
    index("deal_extensions_closed_at_idx").on(table.closedAt),
  ],
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
    reason: text("reason"),
    intakeComment: text("intake_comment"),
    comment: text("comment"),
    requestedAmountMinor: bigint("requested_amount_minor", {
      mode: "bigint",
    }),
    requestedCurrencyId: uuid("requested_currency_id").references(
      () => currencies.id,
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
    index("deals_customer_idx").on(table.customerId),
    index("deals_agreement_idx").on(table.agreementId),
    index("deals_calculation_idx").on(table.calculationId),
    index("deals_agent_idx").on(table.agentId),
    index("deals_status_idx").on(table.status),
    index("deals_type_idx").on(table.type),
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
    status: dealStatusEnum("status").notNull().default("draft"),
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
        ${table.role} = 'organization'
        and ${table.customerId} is null
        and ${table.organizationId} is not null
        and ${table.counterpartyId} is null
      ) or (
        ${table.role} = 'counterparty'
        and ${table.customerId} is null
        and ${table.organizationId} is null
        and ${table.counterpartyId} is not null
      )`,
    ),
  ],
);

export const dealStatusHistory = pgTable(
  "deal_status_history",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    status: dealStatusEnum("status").notNull(),
    changedBy: text("changed_by"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("deal_status_history_deal_created_idx").on(
      table.dealId,
      table.createdAt,
    ),
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
  requestedCurrency: one(currencies, {
    fields: [deals.requestedCurrencyId],
    references: [currencies.id],
  }),
  approvals: many(dealApprovals),
  agentBonuses: many(dealAgentBonuses),
  calculationLinks: many(dealCalculationLinks),
  extension: one(dealExtensions, {
    fields: [deals.id],
    references: [dealExtensions.dealId],
  }),
  legs: many(dealLegs),
  participants: many(dealParticipants),
  statusHistory: many(dealStatusHistory),
}));

export const dealExtensionsRelations = relations(dealExtensions, ({ one }) => ({
  deal: one(deals, {
    fields: [dealExtensions.dealId],
    references: [deals.id],
  }),
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

export const dealStatusHistoryRelations = relations(
  dealStatusHistory,
  ({ one }) => ({
    deal: one(deals, {
      fields: [dealStatusHistory.dealId],
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
