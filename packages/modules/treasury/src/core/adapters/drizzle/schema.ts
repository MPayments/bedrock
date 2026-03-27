import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { reconciliationExternalRecords } from "@bedrock/reconciliation/schema";

import type {
  AllocationType,
  BalanceState,
  BeneficialOwnerType,
  ExecutionEventKind,
  InstructionStatus,
  LegalBasis,
  LegKind,
  ObligationKind,
  OperationKind,
  PositionKind,
  SettlementModel,
  SubmissionChannel,
  TreasuryAccountKind,
} from "../../../shared/domain/taxonomy";

export const treasuryAccounts = pgTable(
  "treasury_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<TreasuryAccountKind>().notNull(),
    ownerEntityId: uuid("owner_entity_id").notNull(),
    operatorEntityId: uuid("operator_entity_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    provider: text("provider"),
    networkOrRail: text("network_or_rail"),
    accountReference: text("account_reference").notNull(),
    reconciliationMode: text("reconciliation_mode"),
    finalityModel: text("finality_model"),
    segregationModel: text("segregation_model"),
    canReceive: boolean("can_receive").notNull().default(true),
    canSend: boolean("can_send").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("treasury_accounts_reference_uq").on(table.accountReference),
    index("treasury_accounts_owner_asset_idx").on(
      table.ownerEntityId,
      table.assetId,
    ),
  ],
);

export const treasuryEndpoints = pgTable(
  "treasury_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => treasuryAccounts.id, { onDelete: "cascade" }),
    endpointType: text("endpoint_type").notNull(),
    value: text("value").notNull(),
    label: text("label"),
    memoTag: text("memo_tag"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("treasury_endpoints_account_type_value_uq").on(
      table.accountId,
      table.endpointType,
      table.value,
    ),
  ],
);

export const counterpartyEndpoints = pgTable(
  "treasury_counterparty_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    counterpartyId: uuid("counterparty_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    endpointType: text("endpoint_type").notNull(),
    value: text("value").notNull(),
    label: text("label"),
    memoTag: text("memo_tag"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("treasury_counterparty_endpoints_uq").on(
      table.counterpartyId,
      table.assetId,
      table.endpointType,
      table.value,
    ),
  ],
);

export const treasuryObligations = pgTable(
  "treasury_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    obligationKind: text("obligation_kind").$type<ObligationKind>().notNull(),
    debtorEntityId: uuid("debtor_entity_id").notNull(),
    creditorEntityId: uuid("creditor_entity_id").notNull(),
    beneficialOwnerType: text("beneficial_owner_type").$type<BeneficialOwnerType>(),
    beneficialOwnerId: uuid("beneficial_owner_id"),
    assetId: uuid("asset_id").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    settledMinor: bigint("settled_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    dueAt: timestamp("due_at", { withTimezone: true }),
    memo: text("memo"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("treasury_obligations_debtor_creditor_idx").on(
      table.debtorEntityId,
      table.creditorEntityId,
    ),
  ],
);

export const treasuryOperations = pgTable(
  "treasury_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idempotencyKey: text("idempotency_key").notNull(),
    operationKind: text("operation_kind").$type<OperationKind>().notNull(),
    economicOwnerEntityId: uuid("economic_owner_entity_id").notNull(),
    executingEntityId: uuid("executing_entity_id").notNull(),
    cashHolderEntityId: uuid("cash_holder_entity_id"),
    beneficialOwnerType: text("beneficial_owner_type").$type<BeneficialOwnerType>(),
    beneficialOwnerId: uuid("beneficial_owner_id"),
    legalBasis: text("legal_basis").$type<LegalBasis>(),
    settlementModel: text("settlement_model").$type<SettlementModel>().notNull(),
    instructionStatus: text("instruction_status")
      .$type<InstructionStatus>()
      .notNull(),
    sourceAccountId: uuid("source_account_id"),
    destinationAccountId: uuid("destination_account_id"),
    sourceAssetId: uuid("source_asset_id"),
    destinationAssetId: uuid("destination_asset_id"),
    sourceAmountMinor: bigint("source_amount_minor", { mode: "bigint" }),
    destinationAmountMinor: bigint("destination_amount_minor", {
      mode: "bigint",
    }),
    memo: text("memo"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("treasury_operations_idempotency_key_uq").on(
      table.idempotencyKey,
    ),
    index("treasury_operations_owner_status_idx").on(
      table.economicOwnerEntityId,
      table.instructionStatus,
    ),
  ],
);

export const treasuryOperationObligations = pgTable(
  "treasury_operation_obligations",
  {
    operationId: uuid("operation_id")
      .notNull()
      .references(() => treasuryOperations.id, { onDelete: "cascade" }),
    obligationId: uuid("obligation_id")
      .notNull()
      .references(() => treasuryObligations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    primaryKey({
      name: "treasury_operation_obligations_pk",
      columns: [table.operationId, table.obligationId],
    }),
  ],
);

export const treasuryExecutionInstructions = pgTable(
  "treasury_execution_instructions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => treasuryOperations.id, { onDelete: "cascade" }),
    sourceAccountId: uuid("source_account_id")
      .notNull()
      .references(() => treasuryAccounts.id, { onDelete: "restrict" }),
    destinationEndpointId: uuid("destination_endpoint_id"),
    submissionChannel: text("submission_channel")
      .$type<SubmissionChannel>()
      .notNull(),
    instructionStatus: text("instruction_status")
      .$type<InstructionStatus>()
      .notNull(),
    assetId: uuid("asset_id").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("treasury_execution_instructions_operation_idx").on(table.operationId)],
);

export const treasuryExecutionEvents = pgTable(
  "treasury_execution_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instructionId: uuid("instruction_id")
      .notNull()
      .references(() => treasuryExecutionInstructions.id, { onDelete: "cascade" }),
    eventKind: text("event_kind").$type<ExecutionEventKind>().notNull(),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    externalRecordId: uuid("external_record_id").references(
      () => reconciliationExternalRecords.id,
      { onDelete: "set null" },
    ),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("treasury_execution_events_instruction_idx").on(table.instructionId),
    uniqueIndex("treasury_execution_events_external_kind_uq").on(
      table.instructionId,
      table.externalRecordId,
      table.eventKind,
    ),
  ],
);

export const treasuryAllocations = pgTable(
  "treasury_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    obligationId: uuid("obligation_id")
      .notNull()
      .references(() => treasuryObligations.id, { onDelete: "cascade" }),
    executionEventId: uuid("execution_event_id")
      .notNull()
      .references(() => treasuryExecutionEvents.id, { onDelete: "cascade" }),
    allocatedMinor: bigint("allocated_minor", { mode: "bigint" }).notNull(),
    allocationType: text("allocation_type").$type<AllocationType>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("treasury_allocations_event_idx").on(table.executionEventId),
    index("treasury_allocations_obligation_idx").on(table.obligationId),
  ],
);

export const treasuryPositions = pgTable(
  "treasury_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originOperationId: uuid("origin_operation_id").references(
      () => treasuryOperations.id,
      { onDelete: "set null" },
    ),
    positionKind: text("position_kind").$type<PositionKind>().notNull(),
    ownerEntityId: uuid("owner_entity_id").notNull(),
    counterpartyEntityId: uuid("counterparty_entity_id"),
    beneficialOwnerType: text("beneficial_owner_type").$type<BeneficialOwnerType>(),
    beneficialOwnerId: uuid("beneficial_owner_id"),
    assetId: uuid("asset_id").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    settledMinor: bigint("settled_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("treasury_positions_owner_kind_idx").on(
      table.ownerEntityId,
      table.positionKind,
    ),
    index("treasury_positions_origin_kind_idx").on(
      table.originOperationId,
      table.positionKind,
    ),
  ],
);

export const treasuryAccountBalanceEntries = pgTable(
  "treasury_account_balance_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => treasuryAccounts.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").notNull(),
    executionEventId: uuid("execution_event_id").references(
      () => treasuryExecutionEvents.id,
      { onDelete: "set null" },
    ),
    instructionId: uuid("instruction_id").references(
      () => treasuryExecutionInstructions.id,
      { onDelete: "set null" },
    ),
    operationId: uuid("operation_id").references(() => treasuryOperations.id, {
      onDelete: "set null",
    }),
    balanceState: text("balance_state").$type<BalanceState>().notNull(),
    legKind: text("leg_kind").$type<LegKind>().notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("treasury_balance_entries_account_asset_idx").on(
      table.accountId,
      table.assetId,
    ),
    index("treasury_balance_entries_operation_idx").on(table.operationId),
  ],
);

export const treasuryDocumentLinks = pgTable(
  "treasury_document_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull(),
    linkKind: text("link_kind")
      .$type<"instruction" | "obligation" | "operation">()
      .notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("treasury_document_links_document_kind_target_uq").on(
      table.documentId,
      table.linkKind,
      table.targetId,
    ),
    index("treasury_document_links_document_kind_idx").on(
      table.documentId,
      table.linkKind,
    ),
  ],
);

export const schema = {
  treasuryAccounts,
  treasuryEndpoints,
  counterpartyEndpoints,
  treasuryObligations,
  treasuryOperations,
  treasuryOperationObligations,
  treasuryExecutionInstructions,
  treasuryExecutionEvents,
  treasuryAllocations,
  treasuryPositions,
  treasuryAccountBalanceEntries,
  treasuryDocumentLinks,
};
