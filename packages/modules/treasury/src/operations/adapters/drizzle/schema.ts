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

export const treasuryOperationFacts = pgTable(
  "treasury_operation_facts",
  {
    id: uuid("id").primaryKey(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => treasuryOperations.id),
    dealId: uuid("deal_id"),
    routeLegId: uuid("route_leg_id"),
    instructionId: uuid("instruction_id"),
    sourceKind: text("source_kind").notNull(),
    sourceRef: text("source_ref").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyId: uuid("currency_id").references(() => currencies.id),
    counterAmountMinor: bigint("counter_amount_minor", { mode: "bigint" }),
    counterCurrencyId: uuid("counter_currency_id").references(() => currencies.id),
    feeAmountMinor: bigint("fee_amount_minor", { mode: "bigint" }),
    feeCurrencyId: uuid("fee_currency_id").references(() => currencies.id),
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
    uniqueIndex("treasury_operation_facts_source_ref_uq").on(table.sourceRef),
    index("treasury_operation_facts_operation_idx").on(table.operationId),
    index("treasury_operation_facts_deal_idx").on(table.dealId),
    index("treasury_operation_facts_route_leg_idx").on(table.routeLegId),
    index("treasury_operation_facts_instruction_idx").on(table.instructionId),
    index("treasury_operation_facts_source_kind_idx").on(table.sourceKind),
    index("treasury_operation_facts_recorded_at_idx").on(table.recordedAt),
  ],
);
