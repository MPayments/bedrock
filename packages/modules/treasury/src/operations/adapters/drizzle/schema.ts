import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { currencies } from "@bedrock/currencies/schema";

import { fxQuotes } from "../../../quotes/adapters/drizzle/schema";
import type {
  TreasuryOperationKind,
  TreasuryOperationState,
} from "../../domain/operation-types";

export const treasuryOperations = pgTable(
  "treasury_operations",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id"),
    customerId: uuid("customer_id"),
    internalEntityOrganizationId: uuid("internal_entity_organization_id"),
    kind: text("kind").$type<TreasuryOperationKind>().notNull(),
    state: text("state")
      .$type<TreasuryOperationState>()
      .notNull()
      .default("planned"),
    sourceRef: text("source_ref").notNull(),
    quoteId: uuid("quote_id").references(() => fxQuotes.id),
    routeLegId: uuid("route_leg_id"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyId: uuid("currency_id").references(() => currencies.id),
    counterAmountMinor: bigint("counter_amount_minor", { mode: "bigint" }),
    counterCurrencyId: uuid("counter_currency_id").references(() => currencies.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_operations_source_ref_uq").on(table.sourceRef),
    index("treasury_operations_deal_idx").on(table.dealId),
    index("treasury_operations_customer_idx").on(table.customerId),
    index("treasury_operations_internal_entity_idx").on(
      table.internalEntityOrganizationId,
    ),
    index("treasury_operations_kind_idx").on(table.kind),
    index("treasury_operations_quote_idx").on(table.quoteId),
    index("treasury_operations_route_leg_idx").on(table.routeLegId),
  ],
);

export const treasuryExecutionFills = pgTable(
  "treasury_execution_fills",
  {
    id: uuid("id").primaryKey(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => treasuryOperations.id),
    dealId: uuid("deal_id"),
    routeVersionId: uuid("route_version_id"),
    routeLegId: uuid("route_leg_id"),
    calculationSnapshotId: uuid("calculation_snapshot_id"),
    instructionId: uuid("instruction_id"),
    sourceKind: text("source_kind").notNull(),
    sourceRef: text("source_ref").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    soldAmountMinor: bigint("sold_amount_minor", { mode: "bigint" }),
    soldCurrencyId: uuid("sold_currency_id").references(() => currencies.id),
    boughtAmountMinor: bigint("bought_amount_minor", { mode: "bigint" }),
    boughtCurrencyId: uuid("bought_currency_id").references(() => currencies.id),
    actualRateNum: bigint("actual_rate_num", { mode: "bigint" }),
    actualRateDen: bigint("actual_rate_den", { mode: "bigint" }),
    fillSequence: bigint("fill_sequence", { mode: "number" }),
    providerCounterpartyId: uuid("provider_counterparty_id"),
    providerRef: text("provider_ref"),
    externalRecordId: text("external_record_id"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_execution_fills_source_ref_uq").on(table.sourceRef),
    index("treasury_execution_fills_operation_idx").on(table.operationId),
    index("treasury_execution_fills_deal_idx").on(table.dealId),
    index("treasury_execution_fills_route_version_idx").on(table.routeVersionId),
    index("treasury_execution_fills_route_leg_idx").on(table.routeLegId),
    index("treasury_execution_fills_instruction_idx").on(table.instructionId),
    index("treasury_execution_fills_source_kind_idx").on(table.sourceKind),
    index("treasury_execution_fills_executed_at_idx").on(table.executedAt),
  ],
);

export const treasuryExecutionFees = pgTable(
  "treasury_execution_fees",
  {
    id: uuid("id").primaryKey(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => treasuryOperations.id),
    dealId: uuid("deal_id"),
    routeVersionId: uuid("route_version_id"),
    routeLegId: uuid("route_leg_id"),
    calculationSnapshotId: uuid("calculation_snapshot_id"),
    instructionId: uuid("instruction_id"),
    fillId: uuid("fill_id").references(() => treasuryExecutionFills.id),
    sourceKind: text("source_kind").notNull(),
    sourceRef: text("source_ref").notNull(),
    chargedAt: timestamp("charged_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    feeFamily: text("fee_family").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyId: uuid("currency_id").references(() => currencies.id),
    routeComponentId: uuid("route_component_id"),
    componentCode: text("component_code"),
    providerCounterpartyId: uuid("provider_counterparty_id"),
    providerRef: text("provider_ref"),
    externalRecordId: text("external_record_id"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_execution_fees_source_ref_uq").on(table.sourceRef),
    index("treasury_execution_fees_operation_idx").on(table.operationId),
    index("treasury_execution_fees_deal_idx").on(table.dealId),
    index("treasury_execution_fees_route_version_idx").on(table.routeVersionId),
    index("treasury_execution_fees_route_leg_idx").on(table.routeLegId),
    index("treasury_execution_fees_instruction_idx").on(table.instructionId),
    index("treasury_execution_fees_fill_idx").on(table.fillId),
    index("treasury_execution_fees_source_kind_idx").on(table.sourceKind),
    index("treasury_execution_fees_charged_at_idx").on(table.chargedAt),
  ],
);

export const treasuryCashMovements = pgTable(
  "treasury_cash_movements",
  {
    id: uuid("id").primaryKey(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => treasuryOperations.id),
    dealId: uuid("deal_id"),
    routeVersionId: uuid("route_version_id"),
    routeLegId: uuid("route_leg_id"),
    calculationSnapshotId: uuid("calculation_snapshot_id"),
    instructionId: uuid("instruction_id"),
    sourceKind: text("source_kind").notNull(),
    sourceRef: text("source_ref").notNull(),
    direction: text("direction").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyId: uuid("currency_id").references(() => currencies.id),
    bookedAt: timestamp("booked_at", { withTimezone: true }).notNull(),
    valueDate: timestamp("value_date", { withTimezone: true }),
    accountRef: text("account_ref"),
    requisiteId: uuid("requisite_id"),
    providerCounterpartyId: uuid("provider_counterparty_id"),
    providerRef: text("provider_ref"),
    statementRef: text("statement_ref"),
    externalRecordId: text("external_record_id"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("treasury_cash_movements_source_ref_uq").on(table.sourceRef),
    index("treasury_cash_movements_operation_idx").on(table.operationId),
    index("treasury_cash_movements_deal_idx").on(table.dealId),
    index("treasury_cash_movements_route_version_idx").on(table.routeVersionId),
    index("treasury_cash_movements_route_leg_idx").on(table.routeLegId),
    index("treasury_cash_movements_instruction_idx").on(table.instructionId),
    index("treasury_cash_movements_source_kind_idx").on(table.sourceKind),
    index("treasury_cash_movements_booked_at_idx").on(table.bookedAt),
  ],
);
